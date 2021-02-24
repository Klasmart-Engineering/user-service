import {
    createConnection,
    Connection,
    getManager,
    getRepository,
    EntityManager,
    Repository,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { User, accountUUID } from './entities/user'
import {
    Organization,
    validateDOB,
    validateEmail,
    validatePhone,
    normalizedLowercaseTrimmed,
    padShortDob,
} from './entities/organization'
import { organizationAdminRole } from './permissions/organizationAdmin'
import { schoolAdminRole } from './permissions/schoolAdmin'
import { parentRole } from './permissions/parent'
import { studentRole } from './permissions/student'
import { teacherRole } from './permissions/teacher'
import { Role } from './entities/role'
import { Class } from './entities/class'
import { Context } from './main'
import { School } from './entities/school'
import { Permission } from './entities/permission'
import { permissionInfo } from './permissions/permissionInfo'
import { PermissionName } from './permissions/permissionNames'

import { getPaginated } from './utils/getpaginated'

export class Model {
    public static async create() {
        try {
            const connection = await createConnection({
                name: 'default',
                type: 'postgres',
                url:
                    process.env.DATABASE_URL ||
                    'postgres://postgres:kidsloop@localhost',
                synchronize: true,
                logging: Boolean(process.env.DATABASE_LOGGING),
                entities: ['src/entities/*.ts'],
            })
            const model = new Model(connection)
            await getManager(connection.name).query(
                'CREATE EXTENSION IF NOT EXISTS pg_trgm'
            )
            console.log('🐘 Connected to postgres')
            return model
        } catch (e) {
            console.log('❌ Failed to connect or initialize postgres')
            throw e
        }
    }

    public static readonly SIMILARITY_THRESHOLD =
        process.env.POSTGRES_TRGM_LIMIT || 0.1

    private connection: Connection
    private manager: EntityManager
    private userRepository: Repository<User>
    private organizationRepository: Repository<Organization>
    private roleRepository: Repository<Role>
    private classRepository: Repository<Class>
    private schoolRepository: Repository<School>
    private permissionRepository: Repository<Permission>

    constructor(connection: Connection) {
        this.connection = connection
        this.manager = getManager(connection.name)
        this.userRepository = getRepository(User, connection.name)
        this.organizationRepository = getRepository(
            Organization,
            connection.name
        )
        this.roleRepository = getRepository(Role, connection.name)
        this.classRepository = getRepository(Class, connection.name)
        this.schoolRepository = getRepository(School, connection.name)
        this.permissionRepository = getRepository(Permission, connection.name)
    }

    public async getMyUser({ token, req }: Context) {
        const userID = req.cookies?.user_id
        const userEmail = token?.email
        const userPhone = token?.phone

        let user

        if (userID && token) {
            if (userEmail) {
                user = await this.userRepository.findOne({
                    email: userEmail,
                    user_id: userID,
                })
            } else if (userPhone) {
                user = await this.userRepository.findOne({
                    phone: userPhone,
                    user_id: userID,
                })
            }
        } else if (token) {
            const hashSource = userEmail || userPhone
            user = await this.userRepository.findOne({ user_id: token.id })

            if (!user) {
                user = new User()
                user.user_id = accountUUID(hashSource)
            }
        }

        if (user) {
            user = await this.updateUserWithTokenDetails(user, token)
        }

        return user
    }

    private async updateUserWithTokenDetails(user: User, token: any) {
        try {
            let modified = false

            //Ensure fields match
            if (token.id && user.user_id !== token.id) {
                user.user_id = token.id
                modified = true
            }

            if (token.email && user.email !== token.email) {
                token.email = normalizedLowercaseTrimmed(token.email)
                if (validateEmail(token.email)) {
                    user.email = token.email
                    modified = true
                }
            }

            if (token.phone && user.phone !== token.phone) {
                if (validatePhone(token.phone)) {
                    user.phone = token.phone
                    modified = true
                }
            }

            if (!user.given_name && token.given_name) {
                user.given_name = token.given_name
                modified = true
            }

            if (!user.family_name && token.family_name) {
                user.family_name = token.family_name
                modified = true
            }

            if (!user.date_of_birth && token.date_of_birth) {
                token.date_of_birth = padShortDob(token.date_of_birth)
                if (validateDOB(token.date_of_birth)) {
                    user.date_of_birth = token.date_of_birth
                    modified = true
                }
            }
            if (!user.username && token.username) {
                user.username = token.username
            }

            if (modified) {
                await this.manager.save(user)
            }

            return user
        } catch (e) {
            console.error(e)
        }
    }

    public async newUser({
        given_name,
        family_name,
        email,
        phone,
        avatar,
        date_of_birth,
        username,
    }: any) {
        console.info('Unauthenticated endpoint call newUser')

        const newUser = new User()
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
        const hashSource = email ?? phone
        if (!hashSource) {
            return null
        }
        newUser.user_id = accountUUID(hashSource)
        newUser.given_name = given_name
        newUser.family_name = family_name
        newUser.email = email
        newUser.phone = phone
        newUser.avatar = avatar
        newUser.date_of_birth = date_of_birth
        newUser.username = username

        await this.manager.save(newUser)
        return newUser
    }

    public async switchUser(
        { user_id }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const userEmail = context.token?.email
        const userPhone = context.token?.phone
        let user = undefined

        if (userEmail) {
            user = await User.findOne({
                where: { email: userEmail, user_id: user_id },
            })
        } else if (userPhone) {
            user = await User.findOne({
                where: { phone: userPhone, user_id: user_id },
            })
        }

        if (!user) {
            throw new Error(
                `Not able to switch to user ${user_id}. Please try authenticating again`
            )
        }

        context.res.cookie('user_id', user.user_id)

        return user
    }

    public async setUser({
        user_id,
        given_name,
        family_name,
        email,
        phone,
        avatar,
        date_of_birth,
        username,
    }: any) {
        console.info('Unauthenticated endpoint call setUser')
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
            if (!validateDOB(date_of_birth)) {
                date_of_birth = undefined
            }
        }

        const user = await this.userRepository.findOneOrFail(user_id)

        if (given_name !== undefined) {
            user.given_name = given_name
        }
        if (family_name !== undefined) {
            user.family_name = family_name
        }
        if (email !== undefined) {
            user.email = email
        }
        if (phone !== undefined) {
            user.phone = phone
        }
        if (avatar !== undefined) {
            user.avatar = avatar
        }
        if (date_of_birth !== undefined) {
            user.date_of_birth = date_of_birth
        }
        if (username !== undefined) {
            user.username = username
        }

        await this.manager.save(user)
        return user
    }
    public async getUser(user_id: string) {
        console.info('Unauthenticated endpoint call getUser')

        const user = await this.userRepository.findOneOrFail(user_id)
        return user
    }

    public async myUsers(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const userEmail = context.token?.email
        const userPhone = context.token?.phone
        let users: User[] = []

        if (userEmail) {
            users = await User.find({ where: { email: userEmail } })
        } else if (userPhone) {
            users = await User.find({ where: { phone: userPhone } })
        }

        if (users.length === 0) {
            throw new Error(`Please try authenticating again`)
        }

        return users
    }

    public async getUsers() {
        console.log('Unauthenticated endpoint call getUsers')

        return await this.userRepository.find()
    }

    public async setOrganization({
        organization_id,
        organization_name,
        address1,
        address2,
        phone,
        shortCode,
    }: Organization) {
        console.info('Unauthenticated endpoint call setOrganization')

        const organization = await this.organizationRepository.findOneOrFail(
            organization_id
        )

        if (organization_name !== undefined) {
            organization.organization_name = organization_name
        }
        if (address1 !== undefined) {
            organization.address1 = address1
        }
        if (address2 !== undefined) {
            organization.address2 = address2
        }
        if (phone !== undefined) {
            organization.phone = phone
        }
        if (shortCode !== undefined) {
            organization.shortCode = shortCode
        }

        await this.manager.save(organization)
        return organization
    }
    public async getOrganization(organization_id: string) {
        console.info('Unauthenticated endpoint call getOrganization')

        const organization = await this.organizationRepository.findOne(
            organization_id
        )
        return organization
    }

    public async getOrganizations({ organization_ids, scope }: any) {
        if (organization_ids) {
            return await scope.whereInIds(organization_ids).getMany()
        } else {
            return await scope.getMany()
        }
    }

    public async v1_getOrganizations(
        context: Context,
        { organization_ids, after, before, first, last, scope }: any
    ) {
        if (organization_ids) {
            scope.whereInIds(organization_ids)
        }

        return getPaginated(this, 'organization', {
            before,
            after,
            first,
            last,
            scope,
        })
    }

    public async v1_getUsers(
        context: Context,
        { after, before, first, last, scope }: any
    ) {
        return getPaginated(this, 'user', {
            before,
            after,
            first,
            last,
            scope,
        })
    }

    public async v1_getRoles(
        context: Context,
        { after, before, first, last, scope }: any
    ) {
        if (!context.permissions.isAdmin && scope) {
            const user_id = context.token?.id || ''
            const orgScope = scope.clone()
            const idsFromOrgs = await orgScope
                .select('Role.role_id')
                .innerJoin('Role.memberships', 'OrganizationMembership')
                .innerJoin('OrganizationMembership.user', 'User')
                .groupBy('Role.role_id, OrganizationMembership.user_id')
                .where('OrganizationMembership.user_id = :user_id', {
                    user_id: user_id,
                })
                .getRawMany()
            const schoolScope = scope.clone()
            const idsFromSchools = await schoolScope
                .select('Role.role_id')
                .innerJoin('Role.schoolMemberships', 'SchoolMembership')
                .innerJoin('SchoolMembership.user', 'User')
                .groupBy('Role.role_id, SchoolMembership.user_id')
                .where('SchoolMembership.user_id = :user_id', {
                    user_id: user_id,
                })
                .getMany()
            const idcontainer = idsFromOrgs.concat(idsFromSchools)
            const ids: string[] = idcontainer.map((x: any) => x.Role_role_id)
            scope.whereInIds(ids)
        }
        return getPaginated(this, 'role', {
            before,
            after,
            first,
            last,
            scope,
        })
    }

    public async createSystemPermissions(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const permissionEntities = new Map<string, Permission>()

        if (info.operation.operation !== 'mutation') {
            return null
        }

        await this._createSystemPermissions()
        await this._inactivateInvalidExistingPermissions()

        return permissionEntities.values()
    }

    private async _createSystemPermissions() {
        const permissionDetails = await permissionInfo()
        const permissionAttributes = []

        for (const permission_name of Object.values(PermissionName)) {
            const permissionInf = permissionDetails.get(permission_name)

            permissionAttributes.push({
                permission_name: permission_name,
                permission_id: permission_name,
                permission_category: permissionInf?.category,
                permission_level: permissionInf?.level,
                permission_group: permissionInf?.group,
                permission_description: permissionInf?.description,
                allow: true,
            })
        }

        await Permission.createQueryBuilder()
            .insert()
            .into(Permission)
            .values(permissionAttributes)
            .orUpdate({
                conflict_target: ['permission_id'],
                overwrite: [
                    'permission_name',
                    'permission_category',
                    'permission_level',
                    'permission_group',
                    'permission_description',
                    'allow',
                ],
            })
            .execute()
    }

    private async _inactivateInvalidExistingPermissions() {
        await Permission.createQueryBuilder()
            .update()
            .set({ allow: false })
            .where('Permission.allow = :allowed', {
                allowed: true,
            })
            .andWhere('Permission.permission_id NOT IN (:...names)', {
                names: Object.values(PermissionName),
            })
            .execute()
    }

    public async createDefaultRoles(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const roles = new Map<string, Role>()

        if (info.operation.operation !== 'mutation') {
            return null
        }

        await this.createSystemPermissions(args, context, info)

        await getManager().transaction(async (manager) => {
            await this._createDefaultRoles(manager, roles)
        })

        return roles.values()
    }

    private async _createDefaultRoles(
        manager: EntityManager = getManager(),
        roles: Map<string, Role>
    ) {
        for (const { role_name, permissions } of [
            organizationAdminRole,
            schoolAdminRole,
            parentRole,
            studentRole,
            teacherRole,
        ]) {
            let role = await Role.findOne({
                where: {
                    role_name: role_name,
                    system_role: true,
                    organization: { organization_id: null },
                },
            })

            if (!role) {
                role = new Role()
                role.role_name = role_name
                role.system_role = true
            }

            await this._assignPermissionsDefaultRoles(
                manager,
                role,
                permissions
            )

            roles.set(role_name, role)
        }

        return roles
    }

    private async _assignPermissionsDefaultRoles(
        manager: EntityManager,
        role: Role,
        permissions: string[]
    ) {
        role.permissions = Promise.resolve([])
        await role.save()

        await manager
            .createQueryBuilder()
            .relation(Role, 'permissions')
            .of(role)
            .add(permissions)
    }

    public async setRole({ role_id, role_name }: Role) {
        console.info('Unauthenticated endpoint call setRole')

        try {
            const role = await this.roleRepository.findOneOrFail(role_id)

            if (role_name !== undefined) {
                role.role_name = role_name
            }

            return role
        } catch (e) {
            console.error(e)
        }
    }
    public async getRole({ role_id }: Role) {
        console.info('Unauthenticated endpoint call getRole')

        try {
            const role = await this.roleRepository.findOneOrFail({ role_id })
            return role
        } catch (e) {
            console.error(e)
        }
    }
    public async getRoles() {
        console.info('Unauthenticated endpoint call getRoles')

        try {
            const roles = await this.roleRepository.find()
            return roles
        } catch (e) {
            console.error(e)
        }
    }

    public async getPermissions(
        context: Context,
        { after, before, first, last }: any
    ) {
        const scope = this.permissionRepository
            .createQueryBuilder()
            .where('Permission.allow = :allowed', {
                allowed: true,
            })

        return getPaginated(this, 'permission', {
            before,
            after,
            first,
            last,
            scope,
        })
    }

    public async getClass({ class_id }: Class) {
        console.info('Unauthenticated endpoint call getClass')

        try {
            const _class = await this.classRepository.findOneOrFail({
                class_id,
            })
            return _class
        } catch (e) {
            console.error(e)
        }
    }
    public async getClasses() {
        console.info('Unauthenticated endpoint call getClasses')

        try {
            const classes = await this.classRepository.find()
            return classes
        } catch (e) {
            console.error(e)
        }
    }

    public async getSchool({ school_id }: School) {
        console.info('Unauthenticated endpoint call getSchool')

        try {
            const school = await this.schoolRepository.findOneOrFail({
                school_id,
            })
            return school
        } catch (e) {
            console.error(e)
        }
    }
}
