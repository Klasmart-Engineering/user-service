import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    getConnection,
    getRepository,
    BaseEntity,
    ManyToMany,
    getManager,
    JoinColumn,
    JoinTable,
    OneToOne,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { Retryable, BackOffPolicy } from 'typescript-retry-decorator'
import { OrganizationMembership } from './organizationMembership'
import { Organization, padShortDob } from './organization'
import { Class } from './class'
import { SchoolMembership } from './schoolMembership'
import { OrganizationOwnership } from './organizationOwnership'
import { v5, v4 as uuid_v4 } from 'uuid'
import { createHash } from 'crypto'
import { Role } from './role'
import { School } from './school'
import { Status } from './status'
import { generateShortCode, validateShortCode } from '../utils/shortcode'
import { Context } from '../main'
import { validateDOB, validateEmail, validatePhone } from '../utils/validations'

@Entity()
export class User extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public user_id!: string

    // Needs to be deprecated
    public user_name = () => `${this.given_name} ${this.family_name}`
    public full_name = () => `${this.given_name} ${this.family_name}`

    @Column({ nullable: true })
    public given_name?: string

    @Column({ nullable: true })
    public family_name?: string

    @Column({ nullable: true })
    public username?: string

    @Column({ nullable: true })
    public email?: string

    @Column({ nullable: true })
    public phone?: string

    @Column({ nullable: true })
    public date_of_birth?: string

    @Column({ nullable: true })
    public gender?: string

    @Column({ nullable: true })
    public avatar?: string

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    @Column({ type: 'boolean', default: false })
    public primary!: boolean

    @Column({ nullable: true })
    public alternate_email?: string

    @Column({ nullable: true })
    public alternate_phone?: string

    @OneToMany(() => OrganizationMembership, (membership) => membership.user)
    @JoinColumn({
        name: 'user_id',
        referencedColumnName: 'user_id',
    })
    public memberships?: Promise<OrganizationMembership[]>

    public async membership(
        { organization_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call user membership by ${context.permissions?.getUserId()}`
        )

        try {
            const membership = await getRepository(
                OrganizationMembership
            ).findOneOrFail({
                where: { user_id: this.user_id, organization_id },
            })
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    @OneToMany(
        () => SchoolMembership,
        (schoolMembership) => schoolMembership.user
    )
    @JoinColumn({ name: 'school_id', referencedColumnName: 'school_id' })
    public school_memberships?: Promise<SchoolMembership[]>

    public async school_membership(
        { school_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call user school_membership by ${context.permissions?.getUserId()}`
        )

        try {
            const membership = await getRepository(
                SchoolMembership
            ).findOneOrFail({ where: { user_id: this.user_id, school_id } })
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    @ManyToMany(() => Class, (class_) => class_.teachers)
    @JoinTable()
    public classesTeaching?: Promise<Class[]>

    @ManyToMany(() => Class, (class_) => class_.students)
    @JoinTable()
    public classesStudying?: Promise<Class[]>

    @OneToOne(() => Organization, (organization) => organization.owner)
    @JoinColumn()
    public my_organization?: Promise<Organization>

    @OneToMany(() => OrganizationOwnership, (orgOwnership) => orgOwnership.user)
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    public organization_ownerships?: Promise<OrganizationOwnership[]>

    public async organizationsWithPermission(
        { permission_name }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call organizationsWithPermission by ${context.permissions?.getUserId()}`
        )

        try {
            return await getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin('OrganizationMembership.roles', 'Role')
                .innerJoin('Role.permissions', 'Permission')
                .groupBy(
                    'OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id'
                )
                .where('OrganizationMembership.user_id = :user_id', {
                    user_id: this.user_id,
                })
                .andWhere('Permission.permission_name = :permission_name', {
                    permission_name,
                })
                .having('bool_and(Permission.allow) = :allowed', {
                    allowed: true,
                })
                .getMany()
        } catch (e) {
            console.error(e)
        }
    }

    public async schoolsWithPermission(
        { permission_name }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call schoolsWithPermission by ${context.permissions?.getUserId()}`
        )

        try {
            const schoolPermissionPromise = getRepository(SchoolMembership)
                .createQueryBuilder()
                .innerJoin('SchoolMembership.roles', 'Role')
                .innerJoin('Role.permissions', 'Permission')
                .groupBy(
                    'SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_id'
                )
                .where('SchoolMembership.user_id = :user_id', {
                    user_id: this.user_id,
                })
                .andWhere('Permission.permission_name = :permission_name', {
                    permission_name,
                })
                .having('bool_and(Permission.allow) = :allowed', {
                    allowed: true,
                })
                .getMany()

            const organizationPermissionPromise = getRepository(
                SchoolMembership
            )
                .createQueryBuilder()
                .innerJoin('SchoolMembership.school', 'School')
                .innerJoin('School.organization', 'SchoolOrganization')
                .innerJoin('SchoolOrganization.memberships', 'OrgMembership')
                .innerJoin('OrgMembership.roles', 'OrgRole')
                .innerJoin('OrgRole.permissions', 'OrgPermission')
                .groupBy(
                    'OrgMembership.user_id, SchoolMembership.school_id, OrgPermission.permission_name, SchoolMembership.user_id'
                )
                .where(
                    'OrgMembership.user_id = :user_id AND SchoolMembership.user_id = :user_id',
                    { user_id: this.user_id }
                )
                .andWhere('OrgPermission.permission_name = :permission_name', {
                    permission_name,
                })
                .having('bool_and(OrgPermission.allow) = :allowed', {
                    allowed: true,
                })
                .getMany()

            const [
                schoolPermissionResults,
                organizationPermissionResults,
            ] = await Promise.all([
                schoolPermissionPromise,
                organizationPermissionPromise,
            ])

            return schoolPermissionResults.concat(
                organizationPermissionResults.filter((a) => {
                    return !schoolPermissionResults.find(
                        (b) => b.school_id === a.school_id
                    )
                })
            )
        } catch (e) {
            console.error(e)
        }
    }

    public async set(
        {
            given_name,
            family_name,
            email,
            phone,
            username,
            date_of_birth,
            gender,
            avatar,
            alternate_email,
            alternate_phone,
        }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call user set by ${context.permissions?.getUserId()}`
        )

        try {
            if (info.operation.operation !== 'mutation') {
                return null
            }
            if (typeof given_name === 'string') {
                this.given_name = given_name
            }
            if (typeof family_name === 'string') {
                this.family_name = family_name
            }
            if (email) {
                if (!validateEmail(email)) {
                    email = undefined
                }
            }
            if (phone) {
                if (!validatePhone(phone)) {
                    phone = undefined
                }
            }
            if (date_of_birth) {
                date_of_birth = padShortDob(date_of_birth)
                if (!validateDOB(date_of_birth)) {
                    date_of_birth = undefined
                }
            }
            if (email !== undefined) {
                this.email = email
            }
            if (phone !== undefined) {
                this.phone = phone
            }
            if (username !== undefined) {
                this.username = username
            }
            if (date_of_birth !== undefined) {
                this.date_of_birth = date_of_birth
            }
            if (gender !== undefined) {
                this.gender = gender
            }

            if (typeof avatar === 'string') {
                this.avatar = avatar
            }

            if (alternate_email && validateEmail(alternate_email)) {
                this.alternate_email = alternate_email
            }

            if (alternate_phone && validatePhone(alternate_phone)) {
                this.alternate_phone = alternate_phone
            }

            await this.save()
            return this
        } catch (e) {
            console.error(e)
        }
    }

    public async setPrimary(
        { scope }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        try {
            // If the operation is not a mutation, abort the process
            if (info.operation.operation !== 'mutation') {
                return false
            }

            const user = await scope
                .andWhere('User.user_id = :user_id', { user_id: this.user_id })
                .getOne()

            // Finding the primary user in this account
            const primaryUser = await getRepository(User).findOne({
                where: [
                    {
                        email: user.email,
                        phone: user.phone,
                        primary: true,
                    },
                ],
            })

            await getManager().transaction(async (manager) => {
                if (primaryUser && primaryUser.user_id !== user.user_id) {
                    /* Setting current primary user as false
                    and putting as primary the given user */
                    primaryUser.primary = false
                    await manager.save(primaryUser)
                }

                user.primary = true
                await manager.save(user)
            })

            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
    public async subjectsTeaching(
        { scope }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        scope = scope
            .innerJoin('Subject.classes', 'Class')
            .innerJoin('Class.teachers', 'User')
            .andWhere('User.user_id = :user_id', {
                user_id: this.user_id,
            })

        return await scope.getMany()
    }

    public async createOrganization(
        { organization_name, address1, address2, phone, shortCode }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call createOrganization by ${context.permissions?.getUserId()}`
        )

        const active_organizations = await OrganizationOwnership.find({
            where: { user_id: this.user_id, status: Status.ACTIVE },
        })
        if (active_organizations.length) {
            throw new Error('Only one active organization per user')
        }

        if (info.operation.operation !== 'mutation') {
            return null
        }

        const my_organization = await this.my_organization
        if (my_organization) {
            throw new Error('Only one organization per user')
        }

        if (shortCode?.length > 0) {
            shortCode = shortCode.toUpperCase()
            if (!validateShortCode(shortCode)) {
                throw 'Invalid shortcode provided'
            }
        }

        const organization = new Organization()
        await getManager().transaction(async (manager) => {
            organization.organization_id = uuid_v4()
            organization.organization_name = organization_name
            organization.address1 = address1
            organization.address2 = address2
            organization.phone = phone
            organization.shortCode =
                shortCode || generateShortCode(organization.organization_id)
            organization.owner = Promise.resolve(this)
            organization.primary_contact = Promise.resolve(this)
            await manager.save(organization)

            const adminRoles = [
                await Role.findOneOrFail({
                    where: {
                        role_name: 'Organization Admin',
                        system_role: true,
                        organization: { organization_id: null },
                    },
                }),
            ]

            const membership = new OrganizationMembership()
            membership.user = Promise.resolve(this)
            membership.user_id = this.user_id
            membership.organization = Promise.resolve(organization)
            membership.organization_id = organization.organization_id
            if (adminRoles) {
                membership.roles = Promise.resolve(adminRoles)
            }
            organization.memberships = Promise.resolve([membership])
            await manager.save(membership)

            const organizationOwnership = new OrganizationOwnership()
            organizationOwnership.user_id = this.user_id
            organizationOwnership.organization_id = organization.organization_id
            await manager.save(organizationOwnership)
        })

        return organization
    }

    public async addOrganization(
        { organization_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call addOrganization by ${context.permissions?.getUserId()}`
        )

        try {
            if (info.operation.operation !== 'mutation') {
                return null
            }

            const organization = await getRepository(
                Organization
            ).findOneOrFail(organization_id)
            const membership = new OrganizationMembership()
            membership.organization_id = organization_id
            membership.organization = Promise.resolve(organization)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    public async addSchool(
        { school_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call addSchool by ${context.permissions?.getUserId()}`
        )

        try {
            if (info.operation.operation !== 'mutation') {
                return null
            }

            const school = await getRepository(School).findOneOrFail(school_id)
            const membership = new SchoolMembership()
            membership.school_id = school_id
            membership.school = Promise.resolve(school)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    @Retryable({
        maxAttempts: 3,
        backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy,
        backOff: 50,
        exponentialOption: { maxInterval: 2000, multiplier: 2 },
    })
    private async retryMerge(otherUser: User): Promise<any> {
        let dberr: any
        const connection = getConnection()
        const queryRunner = connection.createQueryRunner()
        await queryRunner.connect()
        let success = true
        const otherMemberships = await otherUser.memberships
        const ourMemberships = await this.memberships
        const otherSchoolMemberships = await otherUser.school_memberships
        const ourSchoolMemberships = await this.school_memberships
        const otherClassesStudying = await otherUser.classesStudying
        const otherClassesTeaching = await otherUser.classesTeaching
        const ourClassesStudying = await this.classesStudying
        const ourClassesTeaching = await this.classesTeaching

        await queryRunner.startTransaction()
        try {
            let classesStudying = ourClassesStudying || []
            let classesTeaching = ourClassesTeaching || []
            let memberships = ourMemberships || []
            let schoolmemberships = ourSchoolMemberships || []

            if (otherUser.gender) {
                this.gender = otherUser.gender
            }
            if (otherUser.username) {
                this.username = otherUser.username
            }
            if (otherUser.date_of_birth) {
                this.date_of_birth = otherUser.date_of_birth
            }
            memberships = this.mergeOrganizationMemberships(
                memberships,
                otherMemberships
            )
            if (memberships.length > 0) {
                this.memberships = Promise.resolve(memberships)
                await queryRunner.manager.save([this, ...memberships])
            } else {
                this.memberships = undefined
            }

            schoolmemberships = this.mergeSchoolMemberships(
                schoolmemberships,
                otherSchoolMemberships
            )
            if (schoolmemberships.length > 0) {
                this.school_memberships = Promise.resolve(schoolmemberships)
                await queryRunner.manager.save([this, ...schoolmemberships])
            } else {
                this.school_memberships = undefined
            }

            classesStudying = this.mergeClasses(
                classesStudying,
                otherClassesStudying
            )
            if (classesStudying.length > 0) {
                this.classesStudying = Promise.resolve(classesStudying)
                await queryRunner.manager.save([this, ...classesStudying])
            }

            classesTeaching = this.mergeClasses(
                classesTeaching,
                otherClassesTeaching
            )
            if (classesTeaching.length > 0) {
                this.classesTeaching = Promise.resolve(classesTeaching)
                await queryRunner.manager.save([this, ...classesTeaching])
            }

            await otherUser.removeUser(queryRunner.manager)

            queryRunner.commitTransaction()
        } catch (err) {
            success = false
            console.log(err)
            dberr = err
            await queryRunner.rollbackTransaction()
        } finally {
            await queryRunner.release()
        }
        if (success) {
            console.log('success')
            return this
        }
        if (dberr !== undefined) {
            throw dberr
        }
        return null
    }

    public async merge(
        { other_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation' || other_id === undefined) {
            return null
        }
        const otherUser = await getRepository(User).findOne({
            user_id: other_id,
        })
        if (otherUser !== undefined) {
            return this.retryMerge(otherUser)
        }
        return null
    }

    private async removeOrganizationMemberships(manager: any) {
        const organizationMemberships = (await this.memberships) || []
        for (const organizationMembership of organizationMemberships) {
            await organizationMembership.remove(manager)
        }
    }

    private async removeSchoolMemberships(manager: any) {
        const schoolMemberships = (await this.school_memberships) || []
        for (const schoolMembership of schoolMemberships) {
            await schoolMembership.remove(manager)
        }
    }

    // Hard deletes a user
    private async removeUser(manager: any) {
        await this.removeOrganizationMemberships(manager)
        await this.removeSchoolMemberships(manager)
        await manager.remove(this)
    }

    private async inactivateOrganizationMemberships(manager: any) {
        const organizationMemberships = (await this.memberships) || []

        for (const organizationMembership of organizationMemberships) {
            if (organizationMemberships === undefined) {
                throw 'organizationMembership is undefined'
            }

            await organizationMembership.inactivate(manager)
        }
        return organizationMemberships
    }

    private async inactivateSchoolMemberships(manager: any) {
        const schoolMemberships = (await this.school_memberships) || []

        for (const schoolMembership of schoolMemberships) {
            if (schoolMembership === undefined) {
                throw 'schoolMembership is undefined'
            }

            await schoolMembership.inactivate(manager)
        }
        return schoolMemberships
    }

    public async inactivate(manager: any) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await this.inactivateOrganizationMemberships(manager)

        await this.inactivateSchoolMemberships(manager)

        await manager.save(this)
    }

    private mergeOrganizationMemberships(
        toMemberships: OrganizationMembership[],
        fromMemberships?: OrganizationMembership[]
    ): OrganizationMembership[] {
        if (fromMemberships !== undefined) {
            const ourid = this.user_id
            for (const fromMembership of fromMemberships) {
                const found = toMemberships.some(
                    (toMembership) =>
                        toMembership.organization_id ===
                        fromMembership.organization_id
                )
                if (!found) {
                    const membership = new OrganizationMembership()
                    membership.organization_id = fromMembership.organization_id
                    membership.user_id = ourid
                    membership.user = Promise.resolve(this)
                    membership.organization = fromMembership.organization
                    membership.status = fromMembership.status

                    if (fromMembership.roles !== undefined) {
                        membership.roles = Promise.resolve(fromMembership.roles)
                    }
                    toMemberships.push(membership)
                }
            }
        }
        return toMemberships
    }

    private mergeSchoolMemberships(
        toSchoolMemberships: SchoolMembership[],
        fromSchoolMemberships?: SchoolMembership[]
    ): SchoolMembership[] {
        if (fromSchoolMemberships !== undefined) {
            const ourid = this.user_id
            for (const fromSchoolMembership of fromSchoolMemberships) {
                const found = toSchoolMemberships.some(
                    (toSchoolMembership) =>
                        toSchoolMembership.school_id ===
                        fromSchoolMembership.school_id
                )
                if (!found) {
                    const schoolMembership = new SchoolMembership()
                    schoolMembership.user_id = ourid
                    schoolMembership.user = Promise.resolve(this)
                    schoolMembership.school_id = fromSchoolMembership.school_id
                    schoolMembership.school = fromSchoolMembership.school
                    schoolMembership.status = fromSchoolMembership.status
                    if (fromSchoolMembership.roles !== undefined) {
                        schoolMembership.roles = Promise.resolve(
                            fromSchoolMembership.roles
                        )
                    }
                    toSchoolMemberships.push(schoolMembership)
                }
            }
        }
        return toSchoolMemberships
    }

    private mergeClasses(toClasses: Class[], fromClasses?: Class[]): Class[] {
        if (fromClasses !== undefined) {
            for (const fromClass of fromClasses) {
                const found = toClasses.some(
                    (toClass) => toClass.class_id === fromClass.class_id
                )
                if (!found) {
                    toClasses.push(fromClass)
                }
            }
        }
        return toClasses
    }
}

if (!process.env.DOMAIN) {
    console.log(
        'Warning DOMAIN env varible not set, defaulting to kidsloop.net'
    )
}
const domain = process.env.DOMAIN || 'alpha.kidsloop.net'
const accountNamespace = v5(domain, v5.DNS)

export function accountUUID(email?: string) {
    const hash = createHash('sha256')
    if (email) {
        hash.update(email)
    }
    return v5(hash.digest(), accountNamespace)
}
