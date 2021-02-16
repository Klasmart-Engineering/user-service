import {
    createConnection,
    Connection,
    getManager,
    EntityManager,
    getRepository,
    Repository,
    Brackets,
    LessThan,
    MoreThan,
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
    OrganizationCursorArgs,
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

import {
    CursorArgs,
    CursorObject,
    //START_CURSOR,
    //fromCursorHash,
    Paginated,
    paginateData,
    //staleCursorTotal,
    //END_CURSOR,
    //DEFAULT_PAGE_SIZE,
    v1_getPaginated,
} from './utils/paginated.interface'

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
    }: any) {
        console.info('Unauthenticated endpoint call newUser')

        const newUser = new User()
        const hashSource = email ?? phone
        newUser.user_id = accountUUID(hashSource)
        newUser.given_name = given_name
        newUser.family_name = family_name
        newUser.email = email
        newUser.phone = phone
        newUser.avatar = avatar

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
        avatar,
    }: any) {
        console.info('Unauthenticated endpoint call setUser')

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
        if (avatar !== undefined) {
            user.avatar = avatar
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

    private async v1_usersWithAdminPermissions(
        receiver: Model,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number,
        ids?: string[]
    ): Promise<Paginated<User, string>> {
        let timeStamp: number
        let count: number

        if (staleTotal) {
            count = (await receiver.userRepository.count()) || 0
            timeStamp = Date.now()
        } else {
            count = cursor.total || 0
            timeStamp = cursor.timeStamp || 0
        }
        let options: any
        if (direction) {
            options = {
                where: {
                    user_id: LessThan(id),
                },
                order: { user_id: 'DESC' },
                take: limit + 1,
            }
        } else {
            options = {
                where: {
                    user_id: MoreThan(id),
                },
                order: { user_id: 'ASC' },
                take: limit + 1,
            }
        }
        const users = await receiver.userRepository.find(options)
        if (!direction) {
            users.reverse()
        }
        return paginateData<User, string>(
            count,
            timeStamp,
            users,
            true,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    private async v1_usersWithUserPermission(
        receiver: Model,
        user: User,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number,
        ids?: string[]
    ) {
        let users = [] as User[]
        let count = 0
        let timeStamp = 0

        if (
            (direction && user.user_id < id) ||
            (!direction && user.user_id > id)
        ) {
            users = [user]
            count = 1
            timeStamp = Date.now()
        }
        return paginateData<User, string>(
            count,
            timeStamp,
            users,
            true,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }
    public async v1_getUsers(
        context: Context,
        { after, before, first, last }: CursorArgs
    ) {
        const empty = paginateData<User, string>(
            0,
            Date.now(),
            [],
            true,
            after ? first || 0 : last || 0
        )
        return v1_getPaginated(
            this,
            context,
            this.v1_usersWithAdminPermissions,
            this.v1_usersWithUserPermission,
            empty,
            true,
            { before, after, first, last }
        )
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

    public async createSystemPermissions(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const permissionEntities = new Map<string, Permission>()

        if (info.operation.operation !== 'mutation') {
            return null
        }

        await getManager().transaction(async (manager) => {
            await this._createSystemPermissions(manager, permissionEntities)
        })

        return permissionEntities.values()
    }

    private async _createSystemPermissions(
        manager: EntityManager = getManager(),
        permissionEntities: Map<string, Permission>
    ) {
        const permissionDetails = await permissionInfo()

        for (const permission_name of Object.values(PermissionName)) {
            const permission =
                (await Permission.findOne({
                    where: {
                        permission_name: permission_name,
                        role_id: null,
                    },
                })) || new Permission()

            const permissionInf = permissionDetails.get(permission_name)

            permission.permission_name = permission_name
            permission.permission_id = permission_name
            permission.permission_category = permissionInf?.category
            permission.permission_level = permissionInf?.level
            permission.permission_group = permissionInf?.group
            permission.permission_description = permissionInf?.description
            permission.allow = true
            permission.role_id = undefined

            permissionEntities.set(permission_name, permission)
        }

        await manager.save([...permissionEntities.values()])
    }

    public async createDefaultRoles(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const roles = new Map<string, Role>()
        const permissionEntities = new Map<string, Permission>()

        if (info.operation.operation !== 'mutation') {
            return null
        }

        await this._createSystemPermissions(undefined, permissionEntities)

        await getManager().transaction(async (manager) => {
            await this._createDefaultRoles(manager, roles, permissionEntities)
        })

        return roles.values()
    }

    private async _createDefaultRoles(
        manager: EntityManager = getManager(),
        roles: Map<string, Role>,
        permissionEntities: Map<string, Permission>
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
                permissionEntities,
                permissions
            )

            await role.save()

            roles.set(role_name, role)
        }

        return roles
    }
    private async v1_organizationsWithAdminPermission(
        receiver: Model,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number,
        organization_ids?: string[]
    ): Promise<Paginated<Organization, string>> {
        let timeStamp: number
        let count: number
        let options: any
        if (direction) {
            options = {
                where: {
                    organization_id: LessThan(id),
                },
                order: { organization_id: 'DESC' },
                take: limit + 1,
            }
        } else {
            options = {
                where: {
                    organization_id: MoreThan(id),
                },
                order: { organization_id: 'ASC' },
                take: limit + 1,
            }
        }
        if (organization_ids) {
            if (staleTotal) {
                const whereparams: any = []
                organization_ids.forEach(function (oid: string) {
                    whereparams.push({ organization_id: oid })
                })
                count =
                    (await receiver.organizationRepository.count({
                        where: whereparams,
                    })) || 0
                timeStamp = Date.now()
            } else {
                timeStamp = cursor.timeStamp || 0
                count = cursor.total || 0
            }

            const organizations = await receiver.organizationRepository.findByIds(
                organization_ids,
                options
            )
            if (!direction) {
                organizations.reverse()
            }
            return paginateData<Organization, string>(
                count,
                timeStamp,
                organizations,
                true,
                limit,
                direction ? undefined : id,
                direction ? id : undefined
            )
        }
        if (staleTotal) {
            count = (await receiver.organizationRepository.count()) || 0
            timeStamp = Date.now()
        } else {
            timeStamp = cursor.timeStamp || 0
            count = cursor.total || 0
        }
        const organizations = await receiver.organizationRepository.find(
            options
        )
        if (!direction) {
            organizations.reverse()
        }
        return paginateData<Organization, string>(
            count,
            timeStamp,
            organizations,
            true,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    private async v1_organizationsWithUserPermission(
        receiver: Model,
        user: User,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number,
        organization_ids?: string[]
    ): Promise<Paginated<Organization, string>> {
        let timeStamp: number
        let count: number
        let sqb = receiver.organizationRepository
            .createQueryBuilder()
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .groupBy(
                'Organization.organization_id, OrganizationMembership.user_id'
            )
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: user.user_id,
            })
        if (organization_ids) {
            sqb = sqb.andWhereInIds(organization_ids)
        }
        if (staleTotal) {
            const countSqb = sqb
            count = (await countSqb.getCount()) || 0
            timeStamp = Date.now()
        } else {
            timeStamp = cursor.timeStamp || 0
            count = cursor.total || 0
        }
        const organizations = await sqb
            .andWhere(
                new Brackets((qb) => {
                    qb.where(
                        direction
                            ? 'Organization.organization_id < :id'
                            : 'Organization.organization_id > :id',
                        {
                            id: id,
                        }
                    )
                })
            )
            .orderBy('Organization.organization_id', direction ? 'DESC' : 'ASC')
            .limit(limit + 1)
            .getMany()

        if (!direction) {
            organizations.reverse()
        }
        return paginateData<Organization, string>(
            count,
            timeStamp,
            organizations,
            true,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    public async v1_getOrganizations(
        context: Context,
        { organization_ids, after, before, first, last }: OrganizationCursorArgs
    ) {
        const empty = paginateData<Organization, string>(
            0,
            Date.now(),
            [],
            true,
            after ? first || 0 : last || 0
        )
        return v1_getPaginated(
            this,
            context,
            this.v1_organizationsWithAdminPermission,
            this.v1_organizationsWithUserPermission,
            empty,
            true,
            { before, after, first, last, organization_ids }
        )
    }

    private async _assignPermissionsDefaultRoles(
        manager: EntityManager,
        role: Role,
        permissionEntities: Map<string, Permission>,
        permissions: string[]
    ) {
        const rolePermissions = []

        for (const permission_name of permissions) {
            const permission = permissionEntities.get(permission_name)
            if (permission) {
                rolePermissions.push(permission)
            }
        }

        role.permissions = Promise.resolve(rolePermissions)
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

    private async v1_rolesWithAdminPermission(
        receiver: Model,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number
    ): Promise<Paginated<Role, string>> {
        let timeStamp: number
        let count: number
        if (staleTotal) {
            count = (await receiver.roleRepository.count()) || 0
            timeStamp = Date.now()
        } else {
            count = cursor.total || 0
            timeStamp = cursor.timeStamp || 0
        }
        let options: any
        if (direction) {
            options = {
                where: {
                    role_id: LessThan(id),
                },
                order: { role_id: 'DESC' },
                take: limit + 1,
            }
        } else {
            options = {
                where: {
                    role_id: MoreThan(id),
                },
                order: { role_id: 'ASC' },
                take: limit + 1,
            }
        }
        const roles = await receiver.roleRepository.find(options)
        if (!direction) {
            roles.reverse()
        }
        return paginateData<Role, string>(
            count,
            timeStamp,
            roles,
            true,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    private async v1_rolesWithUserPermission(
        receiver: Model,
        user: User,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number
    ): Promise<Paginated<Role, string>> {
        let timeStamp: number
        let count: number
        const orgSqb = receiver.roleRepository
            .createQueryBuilder()
            .innerJoin('Role.memberships', 'OrganizationMembership')
            .innerJoin('OrganizationMembership.user', 'User')
            .groupBy('Role.role_id, OrganizationMembership.user_id')
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: user.user_id,
            })
        const schoolSqb = receiver.roleRepository
            .createQueryBuilder()
            .innerJoin('Role.schoolMemberships', 'SchoolMembership')
            .innerJoin('SchoolMembership.user', 'User')
            .groupBy('Role.role_id, SchoolMembership.user_id')
            .where('SchoolMembership.user_id = :user_id', {
                user_id: user.user_id,
            })
        if (staleTotal) {
            const countBothRoles: Role[][] = []

            for (const countSqb of [orgSqb, schoolSqb]) {
                countBothRoles.push(await countSqb.getMany())
            }
            const countRoles = countBothRoles[0].concat(countBothRoles[1])

            const countRoleMap = countRoles.reduce(
                (map, role) => map.set(role.role_id, role),
                new Map()
            )
            count = [...countRoleMap.values()].length
            timeStamp = Date.now()
        } else {
            count = cursor.total || 0
            timeStamp = cursor.timeStamp || 0
        }
        const bothRoles: Role[][] = []
        for (const sqb of [orgSqb, schoolSqb]) {
            bothRoles.push(
                await sqb
                    .andWhere(
                        new Brackets((qb) => {
                            qb.where(
                                direction
                                    ? 'Role.role_id < :id'
                                    : 'Role.role_id > :id',
                                {
                                    id: id,
                                }
                            )
                        })
                    )
                    .orderBy('Role.role_id', direction ? 'DESC' : 'ASC')
                    .limit(limit + 1)
                    .getMany()
            )
        }

        const allRoles = bothRoles[0].concat(bothRoles[1])

        const roleMap = allRoles.reduce(
            (map, role) => map.set(role.role_id, role),
            new Map()
        )
        const roles = [...roleMap.values()]

        return paginateData<Role, string>(
            count,
            timeStamp,
            roles,
            false,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    public async v1_getRoles(
        context: Context,
        { before, after, first, last }: CursorArgs
    ) {
        const empty = paginateData<Role, string>(
            0,
            Date.now(),
            [],
            true,
            after ? first || 0 : last || 0
        )
        return v1_getPaginated(
            this,
            context,
            this.v1_rolesWithAdminPermission,
            this.v1_rolesWithUserPermission,
            empty,
            true,
            { before, after, first, last }
        )
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

    private async v1_classesWithAdminPermissions(
        receiver: Model,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number
    ): Promise<Paginated<Class, string>> {
        let timeStamp: number
        let count: number
        if (staleTotal) {
            count = (await receiver.classRepository.count()) || 0
            timeStamp = Date.now()
        } else {
            timeStamp = cursor.timeStamp || 0
            count = cursor.total || 0
        }
        let options: any
        if (direction) {
            options = {
                where: {
                    class_id: LessThan(id),
                },
                order: { class_id: 'DESC' },
                take: limit + 1,
            }
        } else {
            options = {
                where: {
                    class_id: MoreThan(id),
                },
                order: { class_id: 'ASC' },
                take: limit + 1,
            }
        }
        const classes = await receiver.classRepository.find(options)
        if (!direction) {
            classes.reverse()
        }
        return paginateData<Class, string>(
            count,
            timeStamp,
            classes,
            true,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    private async v1_classesWithUserPermissions(
        receiver: Model,
        user: User,
        cursor: CursorObject<string>,
        id: string,
        direction: boolean,
        staleTotal: boolean,
        limit: number
    ): Promise<Paginated<Class, string>> {
        const teaching: Class[] =
            (await receiver.classRepository
                .createQueryBuilder()
                .relation(User, 'classesTeaching')
                .of(user?.user_id)
                .loadMany()) ?? []

        const studying: Class[] =
            (await receiver.classRepository
                .createQueryBuilder()
                .relation(User, 'classesStudying')
                .of(user?.user_id)
                .loadMany()) ?? []

        const allClasses = teaching.concat(studying)

        //Dedup
        const classMap = allClasses.reduce(
            (map, _class) => map.set(_class.class_id, _class),
            new Map()
        )
        const classes = [...classMap.values()]
        const count = classes.length
        const timeStamp = Date.now()

        return paginateData<Class, string>(
            count,
            timeStamp,
            classes,
            false,
            limit,
            direction ? undefined : id,
            direction ? id : undefined
        )
    }

    public async v1_getClasses(
        context: Context,
        { before, after, first, last }: CursorArgs
    ) {
        const empty = paginateData<Class, string>(
            0,
            Date.now(),
            [],
            true,
            after ? first || 0 : last || 0
        )
        return v1_getPaginated(
            this,
            context,
            this.v1_classesWithAdminPermissions,
            this.v1_classesWithUserPermissions,
            empty,
            true,
            { before, after, first, last }
        )
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
