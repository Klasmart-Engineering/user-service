import {
    Column,
    PrimaryGeneratedColumn,
    Entity,
    OneToMany,
    getRepository,
    getManager,
    JoinColumn,
    In,
    OneToOne,
    ManyToOne,
    BaseEntity,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import {
    MEMBERSHIP_SHORTCODE_MAXLEN,
    OrganizationMembership,
} from './organizationMembership'
import { v4 as uuid_v4 } from 'uuid'
import { OrganizationOwnership } from './organizationOwnership'
import { AgeRange } from './ageRange'
import { Category } from './category'
import { Grade } from './grade'
import { Role } from './role'
import { Subcategory } from './subcategory'
import { User } from './user'
import { Class } from './class'
import { School } from './school'
import { Context } from '../main'
import { PermissionName } from '../permissions/permissionNames'
import { SchoolMembership } from './schoolMembership'
import { Subject } from './subject'
import { Model } from '../model'
import { Status } from './status'
import { Program } from './program'
import {
    generateShortCode,
    SHORTCODE_DEFAULT_MAXLEN,
    validateShortCode,
} from '../utils/shortcode'
import { validateDOB, validateEmail, validatePhone } from '../utils/validations'

export const normalizedLowercaseTrimmed = (x: string) =>
    x?.normalize('NFKC').toLowerCase().trim()

export const padShortDob = (dob: string) => (dob?.length < 7 ? '0' + dob : dob)

@Entity()
export class Organization extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public organization_id!: string

    @Column({ nullable: true })
    public organization_name?: string

    @Column({ nullable: true })
    public address1?: string

    @Column({ nullable: true })
    public address2?: string

    @Column({ nullable: true })
    public phone?: string

    @Column({ nullable: true, length: SHORTCODE_DEFAULT_MAXLEN })
    public shortCode?: string

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @OneToMany(
        () => OrganizationMembership,
        (membership) => membership.organization
    )
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    public memberships?: Promise<OrganizationMembership[]>

    public async membership(
        { user_id }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call organization membership by ${context.permissions?.getUserId()}`
        )

        try {
            const membership = await getRepository(
                OrganizationMembership
            ).findOneOrFail({
                where: { user_id, organization_id: this.organization_id },
            })
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    @OneToOne(() => User, (user) => user.my_organization)
    public owner?: Promise<User>

    @ManyToOne(() => User)
    @JoinColumn()
    public primary_contact?: Promise<User>

    public async roles(args: any, context: any, info: any): Promise<Role[]> {
        return Role.find({
            where: [
                { system_role: true, organization: { organization_id: null } },
                {
                    system_role: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    @OneToMany(() => School, (school) => school.organization)
    @JoinColumn()
    public schools?: Promise<School[]>

    @OneToMany(() => Class, (class_) => class_.organization)
    @JoinColumn()
    public classes?: Promise<Class[]>

    public async ageRanges(
        args: any,
        context: any,
        info: any
    ): Promise<AgeRange[]> {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_age_range_20112
        )

        return AgeRange.find({
            where: [
                { system: true, organization: { organization_id: null } },
                {
                    system: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    public async grades(args: any, context: any, info: any): Promise<Grade[]> {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_grades_20113
        )

        return Grade.find({
            where: [
                { system: true, organization: { organization_id: null } },
                {
                    system: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    public async categories(
        args: any,
        context: any,
        info: any
    ): Promise<Category[]> {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_subjects_20115
        )

        return Category.find({
            where: [
                { system: true, organization: { organization_id: null } },
                {
                    system: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    public async subcategories(
        args: any,
        context: any,
        info: any
    ): Promise<Subcategory[]> {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_subjects_20115
        )

        return Subcategory.find({
            where: [
                { system: true, organization: { organization_id: null } },
                {
                    system: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    public async subjects(
        args: any,
        context: any,
        info: any
    ): Promise<Subject[]> {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_subjects_20115
        )

        return Subject.find({
            where: [
                { system: true, organization: { organization_id: null } },
                {
                    system: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    public async programs(
        args: any,
        context: any,
        info: any
    ): Promise<Program[]> {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_program_20111
        )

        return Program.find({
            where: [
                { system: true, organization: { organization_id: null } },
                {
                    system: false,
                    organization: { organization_id: this.organization_id },
                },
            ],
        })
    }

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    public async set(
        { organization_name, address1, address2, phone, shortCode }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_an_organization_details_5
        )

        try {
            if (typeof organization_name === 'string') {
                this.organization_name = organization_name
            }
            if (typeof address1 === 'string') {
                this.address1 = address1
            }
            if (typeof address2 === 'string') {
                this.address2 = address2
            }
            if (typeof phone === 'string') {
                this.phone = phone
            }
            if (typeof shortCode === 'string') {
                shortCode = shortCode.toUpperCase()
                if (validateShortCode(shortCode)) {
                    this.shortCode = shortCode
                }
            }

            await this.save()

            return this
        } catch (e) {
            console.error(e)
        }
    }

    public async membersWithPermission(
        { permission_name, search_query }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call membersWithPermission by ${context.permissions?.getUserId()}`
        )

        try {
            const query = getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin('OrganizationMembership.user', 'User')
                .innerJoin('OrganizationMembership.roles', 'Role')
                .innerJoin('Role.permissions', 'Permission')
                .groupBy(
                    'OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id, User.given_name, User.family_name'
                )
                .where(
                    'OrganizationMembership.organization_id = :organization_id',
                    { organization_id: this.organization_id }
                )
                .andWhere('Permission.permission_name = :permission_name', {
                    permission_name,
                })
                .having('bool_and(Permission.allow) = :allowed', {
                    allowed: true,
                })

            if (search_query) {
                await getManager().query(
                    `SET pg_trgm.word_similarity_threshold = ${Model.SIMILARITY_THRESHOLD}`
                )

                query
                    .andWhere(
                        "concat(User.given_name, ' ', User.family_name) %> :search_query"
                    )
                    .addSelect(
                        "word_similarity(concat(User.given_name, ' ', User.family_name), :search_query)",
                        'similarity'
                    )
                    .orderBy('similarity', 'DESC')
                    .setParameter('search_query', search_query)
            }

            const results = await query.getMany()
            return results
        } catch (e) {
            console.error(e)
        }
    }

    public async findMembers(
        { search_query }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_users_40110
        )

        try {
            await getManager().query(
                `SET pg_trgm.word_similarity_threshold = ${Model.SIMILARITY_THRESHOLD}`
            )

            return await getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin('OrganizationMembership.user', 'User')
                .where(
                    'OrganizationMembership.organization_id = :organization_id',
                    { organization_id: this.organization_id }
                )
                .andWhere(
                    "concat(User.given_name, ' ', User.family_name) %> :search_query"
                )
                .addSelect(
                    "word_similarity(concat(User.given_name, ' ', User.family_name), :search_query)",
                    'similarity'
                )
                .orderBy('similarity', 'DESC')
                .setParameter('search_query', search_query)
                .getMany()
        } catch (e) {
            console.error(e)
        }
    }

    public async setPrimaryContact(
        { user_id }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_an_organization_details_5
        )

        try {
            const user = await getRepository(User).findOneOrFail({ user_id })
            this.primary_contact = Promise.resolve(user)
            await getManager().save(this)

            return user
        } catch (e) {
            console.error(e)
        }
    }

    public async addUser(
        { user_id, shortcode }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.send_invitation_40882
        )

        try {
            const user = await getRepository(User).findOneOrFail(user_id)
            if (typeof shortcode === 'string') {
                shortcode = shortcode.toUpperCase()
                shortcode = validateShortCode(
                    shortcode,
                    MEMBERSHIP_SHORTCODE_MAXLEN
                )
                    ? shortcode
                    : undefined
            }
            const membership = new OrganizationMembership()
            membership.organization_id = this.organization_id
            membership.organization = Promise.resolve(this)
            membership.user_id = user_id
            membership.user = Promise.resolve(user)
            membership.shortcode =
                shortcode ||
                generateShortCode(user_id, MEMBERSHIP_SHORTCODE_MAXLEN)
            await membership.save()

            return membership
        } catch (e) {
            console.error(e)
        }
    }

    public async inviteUser(
        {
            email,
            phone,
            given_name,
            family_name,
            date_of_birth,
            username,
            gender,
            shortcode,
            organization_role_ids,
            school_ids,
            school_role_ids,
            alternate_email,
            alternate_phone,
        }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const user_id = context.permissions.getUserId()
        const restricted = !(await context.permissions.allowed(
            { organization_id: this.organization_id, user_id },
            PermissionName.send_invitation_40882
        ))
        if (restricted) {
            await context.permissions.rejectIfNotAllowed(
                { organization_id: this.organization_id, user_id },
                PermissionName.join_organization_10881
            )
        }
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }
            email = normalizedLowercaseTrimmed(email)
            phone = normalizedLowercaseTrimmed(phone)
            alternate_email = normalizedLowercaseTrimmed(alternate_email)
            alternate_phone = normalizedLowercaseTrimmed(alternate_phone)

            date_of_birth = padShortDob(date_of_birth)

            const result = await this._setMembership(
                restricted,
                false,
                undefined,
                email,
                phone,
                given_name,
                family_name,
                date_of_birth,
                username,
                gender,
                shortcode,
                organization_role_ids,
                school_ids,
                school_role_ids,
                alternate_email,
                alternate_phone
            )
            return result
        } catch (e) {
            console.error(e)
        }
    }

    public async inviteExternalUser(
        {
            email,
            phone,
            given_name,
            family_name,
            date_of_birth,
            username,
            gender,
            shortcode,
            organization_role_ids,
            school_ids,
            school_role_ids,
            alternate_email,
            alternate_phone,
        }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const user_id = context.permissions.getUserId()
        const restricted = !(await context.permissions.allowed(
            { organization_id: this.organization_id, user_id },
            PermissionName.send_invitation_40882
        ))
        if (restricted) {
            await context.permissions.rejectIfNotAllowed(
                { organization_id: this.organization_id, user_id },
                PermissionName.join_organization_10881
            )
        }
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }
            email = normalizedLowercaseTrimmed(email)
            phone = normalizedLowercaseTrimmed(phone)
            alternate_email = normalizedLowercaseTrimmed(alternate_email)
            alternate_phone = normalizedLowercaseTrimmed(alternate_phone)

            date_of_birth = padShortDob(date_of_birth)

            const result = await this._setMembership(
                restricted,
                false,
                undefined,
                email,
                phone,
                given_name,
                family_name,
                date_of_birth,
                username,
                gender,
                shortcode,
                organization_role_ids,
                school_ids,
                school_role_ids,
                alternate_email,
                alternate_phone
            )
            return result
        } catch (e) {
            console.error(e)
        }
    }

    public async editMembership(
        {
            user_id,
            email,
            phone,
            given_name,
            family_name,
            date_of_birth,
            username,
            gender,
            shortcode,
            organization_role_ids,
            school_ids,
            school_role_ids,
            alternate_email,
            alternate_phone,
        }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        await context.permissions.rejectIfNotAllowed(
            this,
            PermissionName.edit_users_40330
        )
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }
            email = normalizedLowercaseTrimmed(email)
            phone = normalizedLowercaseTrimmed(phone)
            alternate_email = normalizedLowercaseTrimmed(alternate_email)
            alternate_phone = normalizedLowercaseTrimmed(alternate_phone)

            date_of_birth = padShortDob(date_of_birth)

            const result = await this._setMembership(
                false,
                true,
                user_id,
                email,
                phone,
                given_name,
                family_name,
                date_of_birth,
                username,
                gender,
                shortcode,
                organization_role_ids,
                school_ids,
                school_role_ids,
                alternate_email,
                alternate_phone
            )
            return result
        } catch (e) {
            console.error(e)
        }
    }

    private async getRoleLookup(): Promise<(roleId: string) => Promise<Role>> {
        const role_repo = getRepository(Role)
        const roleLookup = async (role_id: string) => {
            const role = await role_repo.findOneOrFail(role_id)
            const checkOrganization = await role.organization
            if (
                !role.system_role &&
                (!checkOrganization ||
                    checkOrganization.organization_id !== this.organization_id)
            ) {
                throw new Error(
                    `Can not assign Organization(${checkOrganization?.organization_id}).Role(${role_id}) to membership in Organization(${this.organization_id})`
                )
            }
            return role
        }
        return roleLookup
    }

    private async findOrCreateUser(
        edit: boolean,
        user_id?: string,
        email?: string,
        phone?: string,
        given_name?: string,
        family_name?: string,
        date_of_birth?: string,
        username?: string,
        alternate_email?: string,
        alternate_phone?: string,
        gender?: string
    ): Promise<User> {
        let user: User
        if (edit) {
            const scope = getRepository(User).createQueryBuilder('user')
            if (email) {
                scope.where('email = :email', { email })
            } else {
                scope.where('phone = :phone', { phone })
            }
            if (user_id) {
                scope.andWhere('user_id = :user_id', { user_id })
            }
            const users = await scope.getMany()
            if (users && users.length > 0) {
                user = users[0]
            } else {
                user_id = uuid_v4()
                user = new User()
                user.user_id = user_id
            }
        } else {
            user_id = uuid_v4()
            user = new User()
            user.user_id = user_id
        }
        user.email = email
        user.phone = phone

        if (given_name !== undefined) {
            user.given_name = given_name
        }
        if (family_name !== undefined) {
            user.family_name = family_name
        }
        if (date_of_birth !== undefined) {
            user.date_of_birth = date_of_birth
        }
        if (username !== undefined) {
            user.username = username
        }
        if (alternate_email && validateEmail(alternate_email)) {
            user.alternate_email = alternate_email
        }

        if (alternate_phone && validatePhone(alternate_phone)) {
            user.alternate_phone = alternate_phone
        }
        if (gender !== undefined) {
            user.gender = gender
        }
        return user
    }

    private async membershipOrganization(
        user: User,
        organizationRoles: Role[],
        shortcode?: string
    ): Promise<OrganizationMembership> {
        const user_id = user.user_id
        const organization_id = this.organization_id
        const membership =
            (await getRepository(OrganizationMembership).findOne({
                organization_id,
                user_id,
            })) || new OrganizationMembership()
        membership.organization_id = this.organization_id
        membership.user_id = user.user_id
        membership.user = Promise.resolve(user)
        membership.organization = Promise.resolve(this)
        membership.roles = Promise.resolve(organizationRoles)
        membership.shortcode =
            shortcode ||
            membership.shortcode ||
            generateShortCode(user_id, MEMBERSHIP_SHORTCODE_MAXLEN)
        return membership
    }

    private async membershipSchools(
        user: User,
        school_ids: string[] = [],
        schoolRoles: Role[]
    ): Promise<[SchoolMembership[], SchoolMembership[]]> {
        const schoolRepo = getRepository(School)
        const user_id = user.user_id
        const schoolMembershipRepo = getRepository(SchoolMembership)
        const oldSchoolMemberships = await schoolMembershipRepo.find({
            user_id,
        })
        const schoolMemberships = await Promise.all(
            school_ids.map(async (school_id) => {
                const school = await schoolRepo.findOneOrFail({ school_id })
                const checkOrganization = await school.organization
                if (
                    !checkOrganization ||
                    checkOrganization.organization_id !== this.organization_id
                ) {
                    throw new Error(
                        `Can not add Organization(${checkOrganization?.organization_id}).School(${school_id}) to membership in Organization(${this.organization_id})`
                    )
                }
                const schoolMembership =
                    (await schoolMembershipRepo.findOne({
                        school_id,
                        user_id,
                    })) || new SchoolMembership()
                schoolMembership.user_id = user_id
                schoolMembership.user = Promise.resolve(user)
                schoolMembership.school_id = school_id
                schoolMembership.school = Promise.resolve(school)
                schoolMembership.roles = Promise.resolve(schoolRoles)

                return schoolMembership
            })
        )
        return [schoolMemberships, oldSchoolMemberships]
    }

    private async _setMembership(
        restricted: boolean,
        edit: boolean,
        user_id?: string,
        email?: string,
        phone?: string,
        given_name?: string,
        family_name?: string,
        date_of_birth?: string,
        username?: string,
        gender?: string,
        shortcode?: string,
        organization_role_ids: string[] = [],
        school_ids: string[] = [],
        school_role_ids: string[] = [],
        alternate_email?: string,
        alternate_phone?: string
    ) {
        if (!validateEmail(email) && validatePhone(email)) {
            phone = email
            email = undefined
        } else if (!validatePhone(phone) && validateEmail(phone)) {
            email = phone
            phone = undefined
        }
        if (!(validateEmail(email) || validatePhone(phone))) {
            throw 'No valid email or international all digit with leading + sign E.164 phone number provided'
        }
        if (!validateDOB(date_of_birth)) {
            date_of_birth = undefined
        }
        if (typeof shortcode === 'string') {
            shortcode = shortcode.toUpperCase()
            if (!validateShortCode(shortcode, MEMBERSHIP_SHORTCODE_MAXLEN)) {
                shortcode = undefined
            }
        }

        return getManager().transaction(async (manager) => {
            console.log(
                '_setMembership',
                email,
                phone,
                user_id,
                given_name,
                family_name,
                date_of_birth,
                username,
                gender,
                shortcode,
                organization_role_ids,
                school_ids,
                school_role_ids,
                alternate_email,
                alternate_phone
            )
            const roleLookup = await this.getRoleLookup()
            const organizationRoles = await Promise.all(
                organization_role_ids.map((role_id) => roleLookup(role_id))
            )
            const schoolRoles = await Promise.all(
                school_role_ids.map((role_id) => roleLookup(role_id))
            )
            const user = await this.findOrCreateUser(
                edit,
                user_id,
                email,
                phone,
                given_name,
                family_name,
                date_of_birth,
                username,
                alternate_email,
                alternate_phone,
                gender
            )
            const membership = await this.membershipOrganization(
                user,
                organizationRoles,
                shortcode
            )
            const [
                schoolMemberships,
                oldSchoolMemberships,
            ] = await this.membershipSchools(user, school_ids, schoolRoles)
            if (restricted) {
                await manager.save([user, membership, ...oldSchoolMemberships])
                return { user, membership, oldSchoolMemberships }
            }
            await manager.remove(oldSchoolMemberships)
            await manager.save([user, membership, ...schoolMemberships])
            return { user, membership, schoolMemberships }
        })
    }

    public async createRole(
        { role_name, role_description }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.create_role_with_permissions_30222
        )

        try {
            const manager = getManager()

            const role = new Role()

            if (typeof role_name === 'string') {
                role.role_name = role_name
            }

            if (typeof role_description === 'string') {
                role.role_description = role_description
            }

            role.organization = Promise.resolve(this)
            await manager.save(role)
            return role
        } catch (e) {
            console.error(e)
        }
    }

    public async createClass(
        { class_name, shortcode }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.create_class_20224
        )

        if (shortcode?.length > 0) {
            shortcode = shortcode.toUpperCase()
            if (!validateShortCode(shortcode)) {
                throw 'Invalid shortcode provided'
            }
        }

        try {
            const manager = getManager()

            const _class = new Class()
            _class.shortcode = shortcode || generateShortCode(class_name)
            _class.class_name = class_name
            _class.organization = Promise.resolve(this)
            await manager.save(_class)

            return _class
        } catch (e) {
            console.error(e)
        }
    }

    public async createSchool(
        { school_name, shortcode }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.create_school_20220
        )

        if (shortcode?.length > 0) {
            shortcode = shortcode.toUpperCase()
            if (!validateShortCode(shortcode)) {
                throw 'Invalid shortcode provided'
            }
        }

        try {
            const school = new School()
            school.school_name = school_name
            school.shortcode = shortcode || generateShortCode(school_name)
            school.organization = Promise.resolve(this)
            await school.save()

            return school
        } catch (e) {
            console.error(e)
        }
    }

    public async createOrUpdateAgeRanges(
        { age_ranges }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return []
        }

        let checkUpdatePermission = false
        let checkCreatePermission = false
        let checkAdminPermission = false
        const permisionContext = { organization_id: this.organization_id }

        const ageRanges = []

        for (const ageRangeDetail of age_ranges) {
            checkUpdatePermission =
                checkUpdatePermission || !!ageRangeDetail?.id
            checkCreatePermission = checkCreatePermission || !ageRangeDetail?.id

            const ageRange =
                (await AgeRange.findOne({ id: ageRangeDetail?.id })) ||
                new AgeRange()

            checkAdminPermission =
                checkAdminPermission ||
                ageRange.system ||
                !!ageRangeDetail?.system

            ageRange.name = ageRangeDetail?.name || ageRange.name

            if (ageRangeDetail?.low_value !== undefined) {
                ageRange.low_value = ageRangeDetail.low_value
            }

            ageRange.low_value_unit =
                ageRangeDetail?.low_value_unit || ageRange.low_value_unit
            ageRange.high_value =
                ageRangeDetail?.high_value || ageRange.high_value
            ageRange.high_value_unit =
                ageRangeDetail?.high_value_unit || ageRange.high_value_unit
            ageRange.organization = Promise.resolve(this)

            if (ageRangeDetail?.system !== undefined) {
                ageRange.system = ageRangeDetail.system
            }

            ageRanges.push(ageRange)
        }

        if (checkAdminPermission) {
            context.permissions.rejectIfNotAdmin()
        }

        if (checkCreatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.create_age_range_20222
            )
        }

        if (checkUpdatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_age_range_20332
            )
        }

        await getManager().save(ageRanges)

        return ageRanges
    }

    public async createOrUpdateGrades(
        { grades }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return []
        }

        let checkUpdatePermission = false
        let checkCreatePermission = false
        let checkAdminPermission = false
        const permisionContext = { organization_id: this.organization_id }

        const dbGrades = []

        for (const gradeDetail of grades) {
            checkUpdatePermission = checkUpdatePermission || !!gradeDetail?.id
            checkCreatePermission = checkCreatePermission || !gradeDetail?.id

            const grade =
                (await Grade.findOne({ id: gradeDetail?.id })) || new Grade()

            checkAdminPermission =
                checkAdminPermission || grade.system || !!gradeDetail?.system

            grade.name = gradeDetail?.name || grade.name

            if (gradeDetail?.progress_from_grade_id) {
                const progressFromGrade = await Grade.findOneOrFail({
                    id: gradeDetail?.progress_from_grade_id,
                })
                grade.progress_from_grade = Promise.resolve(progressFromGrade)
            }

            if (gradeDetail?.progress_to_grade_id) {
                const progressToGrade = await Grade.findOneOrFail({
                    id: gradeDetail?.progress_to_grade_id,
                })
                grade.progress_to_grade = Promise.resolve(progressToGrade)
            }

            grade.organization = Promise.resolve(this)

            if (gradeDetail?.system !== undefined) {
                grade.system = gradeDetail.system
            }

            dbGrades.push(grade)
        }

        if (checkAdminPermission) {
            context.permissions.rejectIfNotAdmin()
        }

        if (checkCreatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.create_grade_20223
            )
        }

        if (checkUpdatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_grade_20333
            )
        }

        await getManager().save(dbGrades)

        return dbGrades
    }

    public async createOrUpdateSubcategories(
        { subcategories }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return []
        }

        let checkUpdatePermission = false
        let checkCreatePermission = false
        let checkAdminPermission = false
        const permisionContext = { organization_id: this.organization_id }

        const dbSubcategories = []

        for (const subcategoryDetail of subcategories) {
            checkUpdatePermission =
                checkUpdatePermission || !!subcategoryDetail?.id
            checkCreatePermission =
                checkCreatePermission || !subcategoryDetail?.id

            const subcategory =
                (await Subcategory.findOne({ id: subcategoryDetail?.id })) ||
                new Subcategory()

            checkAdminPermission =
                checkAdminPermission ||
                subcategory.system ||
                !!subcategoryDetail?.system

            subcategory.name = subcategoryDetail?.name || subcategory.name

            subcategory.organization = Promise.resolve(this)

            if (subcategoryDetail?.system !== undefined) {
                subcategory.system = subcategoryDetail.system
            }

            dbSubcategories.push(subcategory)
        }

        if (checkAdminPermission) {
            context.permissions.rejectIfNotAdmin()
        }

        if (checkCreatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.create_subjects_20227
            )
        }

        if (checkUpdatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_subjects_20337
            )
        }

        await getManager().save(dbSubcategories)

        return dbSubcategories
    }

    public async createOrUpdateCategories(
        { categories }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return []
        }

        let checkUpdatePermission = false
        let checkCreatePermission = false
        let checkAdminPermission = false
        const permisionContext = { organization_id: this.organization_id }

        const dbCategories = []

        for (const categoryDetail of categories) {
            checkUpdatePermission =
                checkUpdatePermission || !!categoryDetail?.id
            checkCreatePermission = checkCreatePermission || !categoryDetail?.id

            const category =
                (await Category.findOne({ id: categoryDetail?.id })) ||
                new Category()

            checkAdminPermission =
                checkAdminPermission ||
                category.system ||
                !!categoryDetail?.system

            category.name = categoryDetail?.name || category.name

            category.organization = Promise.resolve(this)

            if (categoryDetail?.subcategories) {
                const subcategories = await this.getSubcategories(
                    categoryDetail.subcategories
                )
                category.subcategories = Promise.resolve(subcategories)
            }

            if (categoryDetail?.system !== undefined) {
                category.system = categoryDetail.system
            }

            dbCategories.push(category)
        }

        if (checkAdminPermission) {
            context.permissions.rejectIfNotAdmin()
        }

        if (checkCreatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.create_subjects_20227
            )
        }

        if (checkUpdatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_subjects_20337
            )
        }

        await getManager().save(dbCategories)

        return dbCategories
    }

    public async createOrUpdateSubjects(
        { subjects }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return []
        }

        let checkUpdatePermission = false
        let checkCreatePermission = false
        let checkAdminPermission = false
        const permisionContext = { organization_id: this.organization_id }

        const dbSubjects = []

        for (const subjectDetail of subjects) {
            checkUpdatePermission = checkUpdatePermission || !!subjectDetail?.id
            checkCreatePermission = checkCreatePermission || !subjectDetail?.id

            const subject =
                (await Subject.findOne({ id: subjectDetail?.id })) ||
                new Subject()

            checkAdminPermission =
                checkAdminPermission ||
                subject.system ||
                !!subjectDetail?.system

            subject.name = subjectDetail?.name || subject.name

            subject.organization = Promise.resolve(this)

            if (subjectDetail?.categories) {
                const categories = await this.getCategories(
                    subjectDetail.categories
                )
                subject.categories = Promise.resolve(categories)
            }

            if (subjectDetail?.system !== undefined) {
                subject.system = subjectDetail.system
            }

            dbSubjects.push(subject)
        }

        if (checkAdminPermission) {
            context.permissions.rejectIfNotAdmin()
        }

        if (checkCreatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.create_subjects_20227
            )
        }

        if (checkUpdatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_subjects_20337
            )
        }

        await getManager().save(dbSubjects)

        return dbSubjects
    }

    private async getCategories(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Category.find({
            where: { id: In(ids) },
        })
    }

    private async getSubcategories(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Subcategory.find({
            where: { id: In(ids) },
        })
    }

    private async getAgeRanges(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await AgeRange.find({
            where: { id: In(ids) },
        })
    }

    private async getGrades(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Grade.find({
            where: { id: In(ids) },
        })
    }

    private async getSubjects(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Subject.find({
            where: { id: In(ids) },
        })
    }

    public async createOrUpdatePrograms(
        { programs }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return []
        }

        let checkUpdatePermission = false
        let checkCreatePermission = false
        let checkAdminPermission = false
        const permisionContext = { organization_id: this.organization_id }
        const dbPrograms = []

        for (const programDetail of programs) {
            checkUpdatePermission = checkUpdatePermission || !!programDetail?.id
            checkCreatePermission = checkCreatePermission || !programDetail?.id

            const program =
                (await Program.findOne({ id: programDetail?.id })) ||
                new Program()
            checkAdminPermission =
                checkAdminPermission ||
                program.system ||
                !!programDetail?.system

            program.name = programDetail?.name || program.name

            program.organization = Promise.resolve(this)

            if (programDetail?.age_ranges !== undefined) {
                const ageRanges = await this.getAgeRanges(
                    programDetail.age_ranges
                )
                program.age_ranges = Promise.resolve(ageRanges)
            }

            if (programDetail?.grades !== undefined) {
                const grades = await this.getGrades(programDetail.grades)
                program.grades = Promise.resolve(grades)
            }

            if (programDetail?.subjects !== undefined) {
                const subjects = await this.getSubjects(programDetail.subjects)
                program.subjects = Promise.resolve(subjects)
            }

            if (programDetail?.system !== undefined) {
                program.system = programDetail.system
            }

            dbPrograms.push(program)
        }

        if (checkAdminPermission) {
            context.permissions.rejectIfNotAdmin()
        }

        if (checkCreatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.create_program_20221
            )
        }

        if (checkUpdatePermission) {
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_program_20331
            )
        }
        await getManager().save(dbPrograms)

        return dbPrograms
    }

    public async delete(args: any, context: Context, info: GraphQLResolveInfo) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: this.organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_organization_10440
        )

        try {
            await getManager().transaction(async (manager) => {
                await this.inactivate(manager)
            })

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    private async inactivateOrganizationMemberships(manager: any) {
        const organizationMemberships = (await this.memberships) || []

        for (const organizationMembership of organizationMemberships) {
            await organizationMembership.inactivate(manager)
        }

        return organizationMemberships
    }

    private async inactivateSchools(manager: any) {
        const schools = (await this.schools) || []

        for (const school of schools) {
            await school.inactivate(manager)
        }

        return schools
    }

    private async inactivateOwnership(manager: any) {
        const ownership = await OrganizationOwnership.findOne({
            organization_id: this.organization_id,
        })

        if (ownership) {
            await ownership.inactivate(manager)
        }

        return ownership
    }

    public async inactivate(manager: any) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await this.inactivateSchools(manager)
        await this.inactivateOrganizationMemberships(manager)
        await this.inactivateOwnership(manager)
        await manager.save(this)
    }
}
