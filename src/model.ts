import {
    createConnection,
    Connection,
    getManager,
    EntityManager,
    getRepository,
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
import { Role } from './entities/role'
import { Class } from './entities/class'
import { Context } from './main'
import { School } from './entities/school'
import { UserPermissions } from './permissions/userPermissions'

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
            user =
                (await this.userRepository.findOne({ user_id: token.id })) ||
                new User()
        }

        if (!user) {
            return null
        }

        try {
            let modified = false

            //Ensure fields match
            if (user.user_id !== token.id) {
                user.user_id = token.id
                modified = true
            }

            if (user.email !== token.email) {
                token.email = normalizedLowercaseTrimmed(token.email)
                if (validateEmail(token.email)) {
                    user.email = token.email
                    modified = true
                }
            }

            if (user.phone !== token.phone) {
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

    public async getUsers(context: Context) {
        console.log('Unauthenticated endpoint call getUsers')
        let users: User[] = []
        if (context.token) {
            const user = await this.userRepository.findOne({
                user_id: context.token.id,
            })
            if (user !== undefined) {
                const userPermissions = new UserPermissions(context.token)
                try {
                    if (userPermissions.isAdmin) {
                        users = await this.userRepository.find()
                    } else {
                        users = [user]
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }
        return users
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

    public async getOrganizations(
        organization_ids: string[],
        context: Context
    ) {
        console.info('Unauthenticated endpoint call getOrganizations')

        let organizations: Organization[] = []
        if (context.token) {
            const user = await this.userRepository.findOne({
                user_id: context.token.id,
            })

            if (user !== undefined) {
                const userPermissions = new UserPermissions(context.token)
                try {
                    if (userPermissions.isAdmin) {
                        if (organization_ids) {
                            organizations = await this.organizationRepository.findByIds(
                                organization_ids
                            )
                        } else {
                            organizations = await this.organizationRepository.find()
                        }
                    } else {
                        if (!organization_ids) {
                            organizations = await this.organizationRepository
                                .createQueryBuilder()
                                .innerJoin(
                                    'Organization.memberships',
                                    'OrganizationMembership'
                                )
                                .groupBy(
                                    'Organization.organization_id, OrganizationMembership.user_id'
                                )
                                .where(
                                    'OrganizationMembership.user_id = :user_id',
                                    {
                                        user_id: user.user_id,
                                    }
                                )
                                .getMany()
                        } else {
                            organizations = await this.organizationRepository
                                .createQueryBuilder()
                                .innerJoin(
                                    'Organization.memberships',
                                    'OrganizationMembership'
                                )
                                .groupBy(
                                    'Organization.organization_id, OrganizationMembership.user_id'
                                )
                                .where(
                                    'OrganizationMembership.user_id = :user_id',
                                    {
                                        user_id: user.user_id,
                                    }
                                )
                                .andWhereInIds(organization_ids)
                                .getMany()
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }
        return organizations
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
    public async getRoles(context: Context) {
        console.info('Unauthenticated endpoint call getRoles')
        let roles: Role[] = []
        if (context.token) {
            const user = await this.userRepository.findOne({
                user_id: context.token.id,
            })
            if (user !== undefined) {
                const userPermissions = new UserPermissions(context.token)
                try {
                    if (userPermissions.isAdmin) {
                        roles = await this.roleRepository.find()
                    } else {
                        const orgRoles = await this.roleRepository
                            .createQueryBuilder()
                            .innerJoin(
                                'Role.memberships',
                                'OrganizationMembership'
                            )
                            .innerJoin('OrganizationMembership.user', 'User')
                            .groupBy(
                                'Role.role_id, OrganizationMembership.user_id'
                            )
                            .where(
                                'OrganizationMembership.user_id = :user_id',
                                {
                                    user_id: user.user_id,
                                }
                            )
                            .getMany()

                        const schoolRoles = await this.roleRepository
                            .createQueryBuilder()
                            .innerJoin(
                                'Role.schoolMemberships',
                                'SchoolMembership'
                            )
                            .innerJoin('SchoolMembership.user', 'User')
                            .groupBy('Role.role_id, SchoolMembership.user_id')
                            .where('SchoolMembership.user_id = :user_id', {
                                user_id: user.user_id,
                            })
                            .getMany()

                        const allRoles = orgRoles.concat(schoolRoles)

                        const roleMap = allRoles.reduce(
                            (map, role) => map.set(role.role_id, role),
                            new Map()
                        )
                        roles = [...roleMap.values()]
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }
        return roles
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
    public async getClasses(context: Context) {
        console.info('Unauthenticated endpoint call getClasses')
        let classes: Class[] = []
        if (context.token) {
            const user = await this.userRepository.findOne({
                user_id: context.token.id,
            })
            if (user !== undefined) {
                const userPermissions = new UserPermissions(context.token)
                try {
                    if (userPermissions.isAdmin) {
                        classes = await this.classRepository.find()
                    } else {
                        const teaching: Class[] =
                            (await this.classRepository
                                .createQueryBuilder()
                                .relation(User, 'classesTeaching')
                                .of(user?.user_id)
                                .loadMany()) ?? []

                        const studying: Class[] =
                            (await this.classRepository
                                .createQueryBuilder()
                                .relation(User, 'classesStudying')
                                .of(user?.user_id)
                                .loadMany()) ?? []

                        const allClasses = teaching.concat(studying)

                        const classMap = allClasses.reduce(
                            (map, _class) => map.set(_class.class_id, _class),
                            new Map()
                        )
                        classes = [...classMap.values()]
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }
        return classes
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
