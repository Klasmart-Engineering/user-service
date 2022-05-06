import {
    createConnection,
    Connection,
    getManager,
    getRepository,
    EntityManager,
    Repository,
    SelectQueryBuilder,
    getConnection,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { User } from './entities/user'
import { OrganizationMembership } from './entities/organizationMembership'
import { SchoolMembership } from './entities/schoolMembership'
import { Organization } from './entities/organization'
import AgeRangesInitializer from './initializers/ageRanges'
import { AgeRange } from './entities/ageRange'
import CategoriesInitializer from './initializers/categories'
import GradesInitializer from './initializers/grades'
import { Role } from './entities/role'
import ProgramsInitializer from './initializers/programs'
import RolesInitializer from './initializers/roles'
import SubcategoriesInitializer from './initializers/subcategories'
import SubjectsInitializer from './initializers/subjects'
import { Class } from './entities/class'
import { Context } from './main'
import { School } from './entities/school'
import { Permission } from './entities/permission'
import { v4 as uuid_v4 } from 'uuid'
import clean from './utils/clean'
import {
    validateUserCSVHeaders,
    processUserFromCSVRows,
} from './utils/csv/user'
import { processClassFromCSVRow } from './utils/csv/class'
import { createEntityFromCsvWithRollBack } from './utils/csv/importEntity'
import { processGradeFromCSVRow, setGradeFromToFields } from './utils/csv/grade'
import { processOrganizationFromCSVRow } from './utils/csv/organization'
import { processSchoolFromCSVRow } from './utils/csv/school'
import { processSubCategoriesFromCSVRow } from './utils/csv/subCategories'
import { processRoleFromCSVRow } from './utils/csv/role'
import { processCategoryFromCSVRow } from './utils/csv/category'
import { processSubjectFromCSVRow } from './utils/csv/subject'
import { IPaginationArgs } from './utils/pagination/paginate'
import { processProgramFromCSVRow } from './utils/csv/program'
import { processAgeRangeFromCSVRow } from './utils/csv/ageRange'
import {
    renameNullOrganizations,
    renameDuplicatedOrganizations,
} from './utils/renameMigration/organization'
import { isDOB, isEmail, isPhone } from './utils/validations'
import { renameDuplicatedSubjects } from './utils/renameMigration/subjects'
import { Program } from './entities/program'
import { renameDuplicatedGrades } from './utils/renameMigration/grade'
import { Grade } from './entities/grade'
import { Category } from './entities/category'
import { Subcategory } from './entities/subcategory'
import { Subject } from './entities/subject'
import { Upload } from './types/upload'
import {
    BrandingResult,
    BrandingImageInfo,
    BrandingImageTag,
    deleteBrandingImageInput,
    setBrandingInput,
    DeleteBrandingColorInput,
} from './types/graphQL/branding'
import { BrandingStorer } from './services/brandingStorer'
import { CloudStorageUploader } from './services/cloudStorageUploader'
import { buildFilePath } from './utils/storage'
import { Branding } from './entities/branding'
import { CustomError, customErrors } from './types/errors/customError'
import BrandingErrorConstants from './types/errors/branding/brandingErrorConstants'
import { BrandingError } from './types/errors/branding/brandingError'
import { BrandingImage } from './entities/brandingImage'
import { Status } from './entities/status'
import { runMigrations } from './initializers/migrations'
import { usersConnectionResolver } from './pagination/usersConnection'
import { schoolsConnectionResolver } from './pagination/schoolsConnection'
import { organizationsConnectionResolver } from './pagination/organizationsConnection'
import logger, { TypeORMLogger } from './logging'
import { ReplaceRoleArguments } from './operations/roles'
import { PermissionName } from './permissions/permissionNames'
import { APIError, APIErrorCollection } from './types/errors/apiError'
import { rolesConnectionResolver } from './pagination/rolesConnection'
import { categoriesConnectionResolver } from './pagination/categoriesConnection'
import { programsConnectionResolver } from './pagination/programsConnection'
import { classesConnectionResolver } from './pagination/classesConnection'
import { gradesConnectionResolver } from './pagination/gradesConnection'
import { ageRangesConnectionResolver } from './pagination/ageRangesConnection'
import { subjectsConnectionResolver } from './pagination/subjectsConnection'
import { TokenPayload } from './token'
import {
    eligibleMembersConnectionResolver,
    EligibleMembersPaginationArgs,
} from './pagination/eligibleMembersConnection'
import { getEnvVar } from './config/config'
import { reportError } from './utils/resolvers/errors'
import { CSVError } from './types/csv/csvError'
import { UserPermissions } from './permissions/userPermissions'
import { QueryResultCache } from './utils/csv/csvUtils'

// this is a wrapper around legacy functions for
// processing a CSV row
// these legacy functions are inefficent as they don't
// batch reading/writting to the DB
// to allow batching where needed, the CSV framework
// now requires a wrapper function like this
export async function legacyCsvRowFunctionWrapper<RowType>(
    manager: EntityManager,
    rows: RowType[],
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions,
    queryResultCache: QueryResultCache,
    rowFunction: (
        manager: EntityManager,
        row: RowType,
        rowNumber: number,
        fileErrors: CSVError[],
        userPermissions: UserPermissions,
        queryResultCache: QueryResultCache
    ) => Promise<CSVError[]>
) {
    const allRowErrors = []

    for (const [index, row] of rows.entries()) {
        const rowErrors = await rowFunction(
            manager,
            row,
            rowNumber + index,
            fileErrors,
            userPermissions,
            queryResultCache
        )
        allRowErrors.push(...rowErrors)
    }
    return allRowErrors
}

export class Model {
    public static async create() {
        const RO_DATABASE_URL = getEnvVar('RO_DATABASE_URL')!
        const RO_DATABASE = RO_DATABASE_URL
            ? [
                  {
                      url: RO_DATABASE_URL,
                  },
              ]
            : []

        try {
            const connection = await createConnection({
                name: 'default',
                type: 'postgres',
                synchronize: false,
                logger:
                    getEnvVar('DATABASE_LOGGING') === 'true'
                        ? new TypeORMLogger()
                        : undefined,
                entities: ['src/entities/*{.ts,.js}'],
                migrations: ['migrations/*{.ts,.js}'],
                replication: {
                    master: {
                        url: getEnvVar(
                            'DATABASE_URL',
                            'postgres://postgres:kidsloop@localhost'
                        ),
                    },
                    slaves: RO_DATABASE,
                },
            })

            await runMigrations(connection)

            const model = new Model(connection)
            await getManager(connection.name).query(
                'CREATE EXTENSION IF NOT EXISTS pg_trgm'
            )
            await model.createOrUpdateSystemEntities()
            logger.info('🐘 Connected to postgres')
            return model
        } catch (e) {
            logger.error('❌ Failed to connect or initialize postgres')
            reportError(e)
            throw e
        }
    }

    public static readonly SIMILARITY_THRESHOLD = getEnvVar(
        'POSTGRES_TRGM_LIMIT',
        '0.1'
    )

    private connection: Connection
    private manager: EntityManager
    private userRepository: Repository<User>
    private organizationRepository: Repository<Organization>
    private roleRepository: Repository<Role>
    private classRepository: Repository<Class>
    private schoolRepository: Repository<School>
    private permissionRepository: Repository<Permission>
    private ageRangeRepository: Repository<AgeRange>
    private organizationMembershipRepository: Repository<OrganizationMembership>
    private schoolMembershipRepository: Repository<SchoolMembership>

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
        this.ageRangeRepository = getRepository(AgeRange, connection.name)
        this.organizationMembershipRepository = getRepository(
            OrganizationMembership,
            connection.name
        )
        this.schoolMembershipRepository = getRepository(
            SchoolMembership,
            connection.name
        )
    }

    public async getMyUser(token: TokenPayload) {
        const user_id = token.id
        if (!user_id) {
            return undefined
        }

        const user = await this.userRepository.findOne({
            where: { user_id },
        })
        return user
    }

    public async newUser({
        given_name,
        family_name,
        email,
        phone,
        avatar,
        date_of_birth,
        username,
    }: Partial<User>) {
        const newUser = new User()
        if (email) {
            if (!isEmail(email)) {
                email = undefined
            }
        }
        if (phone) {
            phone = clean.phone(phone, false) ?? undefined
            if (!isPhone(phone)) {
                phone = undefined
            }
        }
        if (date_of_birth) {
            date_of_birth = clean.dateOfBirth(date_of_birth)
            if (!isDOB(date_of_birth)) {
                date_of_birth = undefined
            }
        }
        if (!(email || phone || username)) {
            return null
        }
        newUser.user_id = uuid_v4()
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

    public async setUser({
        user_id,
        given_name,
        family_name,
        email,
        phone,
        avatar,
        date_of_birth,
        username,
        alternate_email,
        alternate_phone,
    }: Partial<User>) {
        if (email) {
            if (!isEmail(email)) {
                email = undefined
            }
        }
        if (phone) {
            phone = clean.phone(phone, false) ?? undefined
            if (!isPhone(phone)) {
                phone = undefined
            }
        }
        if (date_of_birth) {
            if (!isDOB(date_of_birth)) {
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

        user.alternate_email = clean.email(alternate_email)

        alternate_phone = clean.phone(alternate_phone, false)
        if (alternate_phone !== null && !isPhone(alternate_phone)) {
            alternate_phone = undefined
        }
        user.alternate_phone = alternate_phone

        await this.manager.save(user)
        return user
    }
    public async getUser(user_id: string) {
        const user = await this.userRepository.findOneOrFail(user_id)
        return user
    }

    public async myUsers(token: TokenPayload) {
        const email = token.email
        const phone = token.phone
        const username = token.user_name
        let users: User[] = []

        const scope = getRepository(User)
            .createQueryBuilder()
            .distinctOn(['User.user_id'])
            .innerJoin('User.memberships', 'OrganizationMembership')
            .where('OrganizationMembership.status=:status', {
                status: Status.ACTIVE,
            })
            .andWhere('User.status=:status', {
                status: Status.ACTIVE,
            })
        if (username) {
            users = await scope
                .andWhere('User.username = :username', {
                    username,
                })
                .getMany()
            // we expect usernames to be globally unique
            // so throw an error instead of leaking data
            // https://calmisland.atlassian.net/browse/AD-1868
            if (users.length > 1) {
                throw new Error('Username is not unique')
            }
        } else if (email) {
            users = await scope
                .andWhere('User.email = :email', {
                    email,
                })
                .getMany()
        } else if (phone) {
            users = await scope
                .andWhere('User.phone = :phone', {
                    phone,
                })
                .getMany()
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
        const organization = await this.organizationRepository.findOne(
            organization_id
        )
        return organization
    }

    public async getOrganizations({
        organization_ids,
        scope,
    }: {
        organization_ids: string[]
        scope: SelectQueryBuilder<Organization>
    }) {
        if (organization_ids) {
            return await scope.whereInIds(organization_ids).getMany()
        } else {
            return await scope.getMany()
        }
    }

    public organizationsConnection = (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Organization>
    ) => organizationsConnectionResolver(info, paginationArgs)

    public usersConnection = (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<User>
    ) => usersConnectionResolver(info, paginationArgs)

    public schoolsConnection = async (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<School>
    ) => schoolsConnectionResolver(info, paginationArgs)

    public programsConnection = async (
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Program>
    ) => programsConnectionResolver(info, paginationArgs)

    public rolesConnection = (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Role>
    ) => rolesConnectionResolver(info, paginationArgs)

    public gradesConnection = (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Grade>
    ) => gradesConnectionResolver(info, paginationArgs)

    public ageRangesConnection = (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<AgeRange>
    ) => ageRangesConnectionResolver(info, paginationArgs)

    public classesConnection = async (
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Class>
    ) => classesConnectionResolver(info, paginationArgs)

    public subjectsConnection = async (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Subject>
    ) => subjectsConnectionResolver(info, paginationArgs)

    public categoriesConnection = (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: IPaginationArgs<Category>
    ) => categoriesConnectionResolver(info, paginationArgs)

    public eligibleStudentsConnection = async (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: EligibleMembersPaginationArgs
    ) =>
        eligibleMembersConnectionResolver(
            info,
            PermissionName.attend_live_class_as_a_student_187,
            paginationArgs
        )

    public eligibleTeachersConnection = async (
        _context: Context,
        info: GraphQLResolveInfo,
        paginationArgs: EligibleMembersPaginationArgs
    ) =>
        eligibleMembersConnectionResolver(
            info,
            PermissionName.attend_live_class_as_a_teacher_186,
            paginationArgs
        )

    public async getRole({
        role_id,
        scope,
    }: {
        role_id: string
        scope: SelectQueryBuilder<Role> | undefined
    }) {
        //if it's a mutation, the isAdmin scope is not needed to be injected because the permissions are checked on the further method
        if (!scope) {
            scope = this.roleRepository.createQueryBuilder('Role')
        }
        const role = await scope
            .andWhere('Role.role_id = :role_id', {
                role_id,
            })
            .getOne()
        return role ?? null
    }

    public async getRoles({
        scope,
    }: {
        scope: SelectQueryBuilder<Role> | undefined
    }) {
        if (!scope) {
            scope = this.roleRepository.createQueryBuilder('Role')
        }
        return await scope.getMany()
    }

    public async replaceRole(
        { old_role_id, new_role_id, organization_id }: ReplaceRoleArguments,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const user_id = context.permissions.getUserId()
        await context.permissions.rejectIfNotAllowed(
            { organization_ids: [organization_id], user_id },
            PermissionName.edit_users_40330
        )

        const errors: APIError[] = []
        const organization = await getRepository(Organization).findOneOrFail(
            organization_id
        )
        const newRole = await getRepository(Role).findOneOrFail(new_role_id)
        const newRoleOrganization = await newRole.organization
        if (info.operation.operation !== 'mutation')
            errors.push(
                new APIError({
                    code: customErrors.invalid_operation_type.code,
                    message: customErrors.invalid_operation_type.message,
                    variables: [],
                    attribute: info.operation.operation,
                    otherAttribute: 'mutation',
                })
            )
        if (organization.status !== Status.ACTIVE)
            errors.push(
                new APIError({
                    code: customErrors.inactive_status.code,
                    message: customErrors.inactive_status.message,
                    variables: ['organization_id'],
                    entity: 'Organization',
                    entityName: organization.organization_name,
                })
            )
        if (
            !newRole.system_role &&
            newRoleOrganization?.organization_id !== organization_id
        )
            errors.push(
                new APIError({
                    code: customErrors.nonexistent_child.code,
                    message: customErrors.nonexistent_child.message,
                    variables: ['role_id', 'organization_id'],
                    entity: 'Role',
                    entityName: newRole.role_name,
                    parentEntity: 'Organization',
                    parentName: organization.organization_name,
                })
            )
        if (errors.length > 0) throw new APIErrorCollection(errors)

        const orgMembIds = getRepository(OrganizationMembership)
            .createQueryBuilder('OM') // alias for OrganizationMembership table
            .select('OM.user_id, OM.organization_id')
            .innerJoin('OM.roles', 'Role')
            .where('OM.organization_id = :organization_id', {
                organization_id,
            })
            .andWhere('Role.role_id = :role_id', {
                role_id: old_role_id,
            })
        const orgMembsWithRoles = await getRepository(OrganizationMembership)
            .createQueryBuilder('OM1') // alias for main OrganizationMembership table
            .setParameters(orgMembIds.getParameters())
            .innerJoin(
                '(' + orgMembIds.getQuery() + ')',
                'OM2', // alias for filtered table of OrganizationMemberships
                '"OM2"."user_id" = OM1.user_id AND "OM2"."organization_id" = OM1.organization_id'
            )
            .innerJoinAndSelect('OM1.roles', 'Role')
            .getMany()

        const schoolMembsIds = getRepository(SchoolMembership)
            .createQueryBuilder('SM') // alias for SchoolMembership table
            .select('SM.user_id, SM.school_id')
            .innerJoin('SM.roles', 'Role')
            .innerJoin('SM.school', 'School')
            .where(`School.organization = :organization_id`, {
                organization_id,
            })
            .andWhere('Role.role_id = :role_id', {
                role_id: old_role_id,
            })
        const schoolMembsWithRoles = await getRepository(SchoolMembership)
            .createQueryBuilder('SM1') // alias for main SchoolMembership table
            .setParameters(schoolMembsIds.getParameters())
            .innerJoin(
                '(' + schoolMembsIds.getQuery() + ')',
                'SM2', // alias for filtered table of SchoolMemberships
                '"SM2"."user_id" = SM1.user_id AND "SM2"."school_id" = SM1.school_id'
            )
            .innerJoinAndSelect('SM1.roles', 'Role')
            .getMany()

        if (!orgMembsWithRoles.length && !schoolMembsWithRoles.length)
            return null

        const roleUpdate = async (
            memb: OrganizationMembership | SchoolMembership
        ) => {
            let roles = await memb.roles
            if (!roles) return
            roles = roles.filter((r) => r.role_id != old_role_id)
            if (roles.every((r) => r.role_id != new_role_id))
                roles.push(newRole)
            memb.roles = Promise.resolve(roles)
        }
        await Promise.all(orgMembsWithRoles.map(roleUpdate))
        await Promise.all(schoolMembsWithRoles.map(roleUpdate))

        await this.manager.save([...orgMembsWithRoles, ...schoolMembsWithRoles])
        return newRole
    }

    public async getClass({ class_id }: Class, context: Context) {
        try {
            const _class = await this.classRepository.findOneOrFail({
                class_id,
            })
            return _class
        } catch (e) {
            logger.warn(e)
        }
    }

    public async getClasses(context: Context) {
        try {
            const classes = await this.classRepository.find()
            return classes
        } catch (e) {
            logger.warn(e)
        }
    }

    public async getSchool({
        school_id,
        scope,
    }: {
        school_id: string
        scope: SelectQueryBuilder<School> | undefined
    }) {
        //if it's a mutation, the isAdmin scope is not needed to be injected because the permissions are checked on the further method
        if (!scope) {
            scope = this.schoolRepository.createQueryBuilder('School')
        }
        const school = await scope
            .andWhere('School.school_id = :school_id', {
                school_id,
            })
            .getOne()
        return school ?? null
    }

    public async getAgeRange(
        { id, scope }: { id: string; scope: SelectQueryBuilder<AgeRange> },
        context: Context
    ) {
        const ageRange = await scope
            .andWhere('AgeRange.id = :id', {
                id: id,
            })
            .getOne()

        return ageRange
    }

    public async getGrade(
        { id, scope }: { id: string; scope: SelectQueryBuilder<Grade> },
        context: Context
    ) {
        const grade = await scope
            .andWhere('Grade.id = :id', {
                id: id,
            })
            .getOne()

        return grade
    }

    public async getCategory(
        { id, scope }: { id: string; scope: SelectQueryBuilder<Category> },
        context: Context
    ) {
        const category = await scope
            .andWhere('Category.id = :id', {
                id: id,
            })
            .getOne()

        return category
    }

    public async getProgram(
        { id, scope }: { id: string; scope: SelectQueryBuilder<Program> },
        context: Context
    ) {
        const program = await scope
            .andWhere('Program.id = :id', {
                id: id,
            })
            .getOne()

        return program
    }

    public async getSubcategory(
        { id, scope }: { id: string; scope: SelectQueryBuilder<Subcategory> },
        context: Context
    ) {
        const subcategory = await scope
            .andWhere('Subcategory.id = :id', {
                id: id,
            })
            .getOne()

        return subcategory
    }

    public async getSubject(
        { id, scope }: { id: string; scope: SelectQueryBuilder<Subject> },
        context: Context
    ) {
        const subject = await scope
            .andWhere('Subject.id = :id', {
                id: id,
            })
            .getOne()

        return subject
    }

    public async createOrUpdateSystemEntities() {
        await RolesInitializer.run()
        await AgeRangesInitializer.run()
        await GradesInitializer.run()
        await SubcategoriesInitializer.run()
        await CategoriesInitializer.run()
        await SubjectsInitializer.run()
        await ProgramsInitializer.run()

        return true
    }

    public static async uploadOrganizationsFromCSV(
        args: Record<string, unknown>,
        context: Pick<Context, 'permissions'>
    ) {
        const { file } = await (args.file as Promise<{ file: Upload }>)

        // Check authorization of user to create any organizations. Must have admin permissions.
        context.permissions.rejectIfNotAdmin()

        await createEntityFromCsvWithRollBack(
            getConnection(),
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) => {
                    return legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processOrganizationFromCSVRow
                    )
                },
            ],
            context.permissions
        )

        return file
    }

    public async uploadUsersFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await (args.file as Promise<{ file: Upload }>)
        const isDryRun = args.isDryRun as boolean
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [processUserFromCSVRows],
            context.permissions,
            validateUserCSVHeaders,
            isDryRun
        )

        return file
    }

    public async uploadClassesFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await (args.file as Promise<{ file: Upload }>)
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) => {
                    return legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processClassFromCSVRow
                    )
                },
            ],
            context.permissions
        )

        return file
    }

    public async uploadSchoolsFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await (args.file as Promise<{ file: Upload }>)
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) => {
                    return legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processSchoolFromCSVRow
                    )
                },
            ],
            context.permissions
        )

        return file
    }

    public async uploadGradesFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await (args.file as Promise<{ file: Upload }>)
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) => {
                    return legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processGradeFromCSVRow
                    )
                },
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) => {
                    return legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        setGradeFromToFields
                    )
                },
            ],
            context.permissions
        )

        return file
    }

    public async uploadSubCategoriesFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = (await args.file) as { file: Upload }
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) =>
                    legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processSubCategoriesFromCSVRow
                    ),
            ],
            context.permissions
        )

        return file
    }

    public async uploadRolesFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = (await args.file) as { file: Upload }
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) =>
                    legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processRoleFromCSVRow
                    ),
            ],
            context.permissions
        )

        return file
    }

    public async uploadCategoriesFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = (await args.file) as { file: Upload }
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) =>
                    legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processCategoryFromCSVRow
                    ),
            ],
            context.permissions
        )

        return file
    }

    public async uploadSubjectsFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = (await args.file) as { file: Upload }
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) =>
                    legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processSubjectFromCSVRow
                    ),
            ],
            context.permissions
        )

        return file
    }

    public async uploadProgramsFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = (await args.file) as { file: Upload }
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) =>
                    legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processProgramFromCSVRow
                    ),
            ],
            context.permissions
        )

        return file
    }

    public async uploadAgeRangesFromCSV(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = (await args.file) as { file: Upload }
        await createEntityFromCsvWithRollBack(
            this.connection,
            file,
            [
                (
                    manager,
                    rows,
                    rowNumber,
                    fileErrors,
                    userPermissions,
                    queryResultCache
                ) =>
                    legacyCsvRowFunctionWrapper(
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache,
                        processAgeRangeFromCSVRow
                    ),
            ],
            context.permissions
        )

        return file
    }

    public async renameDuplicateOrganizations(
        _args: Record<string, unknown>,
        _context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return false
        }

        const queryRunner = this.connection.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            await renameDuplicatedOrganizations(queryRunner.manager)
            await renameNullOrganizations(queryRunner.manager)
            await queryRunner.commitTransaction()
            return true
        } catch (error) {
            await queryRunner.rollbackTransaction()
            return false
        } finally {
            await queryRunner.release()
        }
    }

    public async renameDuplicateSubjects(
        _args: Record<string, unknown>,
        _context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return false
        }

        const queryRunner = this.connection.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            await renameDuplicatedSubjects(queryRunner.manager)
            await queryRunner.commitTransaction()
            return true
        } catch (error) {
            await queryRunner.rollbackTransaction()
            return false
        } finally {
            await queryRunner.release()
        }
    }

    public async renameDuplicateGrades(
        _args: Record<string, unknown>,
        _context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return false
        }

        const queryRunner = this.connection.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            await renameDuplicatedGrades(queryRunner.manager)
            await queryRunner.commitTransaction()

            return true
        } catch (error) {
            await queryRunner.rollbackTransaction()
            return false
        } finally {
            await queryRunner.release()
        }
    }

    public async setBranding(
        args: setBrandingInput,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        let orgBranding: Branding | undefined
        const primaryColor = args.primaryColor
        const iconImage = await args.iconImage
        const organizationId = args.organizationId

        await context.permissions.rejectIfNotAllowedMany(
            organizationId,
            [
                PermissionName.edit_this_organization_10330,
                PermissionName.edit_my_organization_10331,
            ],
            'OR'
        )

        const preloadedBranding = Branding.createQueryBuilder('Branding')
            .innerJoin('Branding.organization', 'Organization')
            .leftJoinAndSelect('Branding.images', 'BrandingImage')
            .where('Organization.organization_id = :organizationId', {
                organizationId,
            })
            .andWhere('Branding.status = :active', { active: Status.ACTIVE })
            .getOne()

        if (!primaryColor || !iconImage) orgBranding = await preloadedBranding

        const result: BrandingResult = {
            iconImageURL: undefined,
            primaryColor: primaryColor ?? orgBranding?.primaryColor,
        }

        const brandingImagesInfo: BrandingImageInfo[] = []

        // Here we should build an image per tag
        if (iconImage) {
            const file = iconImage.file

            for (const tag of Object.values(BrandingImageTag)) {
                // Build path for image
                const remoteFilePath = buildFilePath(
                    organizationId,
                    file.filename,
                    'organizations',
                    tag.toLowerCase()
                )

                // Upload image to cloud
                // The warning here is validand the code could be refactored
                const remoteUrl = await CloudStorageUploader.call(
                    file.createReadStream(),
                    remoteFilePath
                )

                //Safe info for saving later on DB
                if (remoteUrl) {
                    brandingImagesInfo.push({
                        imageUrl: remoteUrl,
                        tag: tag,
                    })
                }

                // Build the resolver output
                const brandingKey = tag.toLowerCase() + 'ImageURL'

                if (Object.keys(result).includes(brandingKey)) {
                    result[brandingKey as keyof BrandingResult] = remoteUrl
                }
            }
        } else {
            const images = orgBranding?.images?.filter((b) => b.tag) || []
            const imagesMap = new Map<string, BrandingImage>(
                images.map((b) => [b.tag!, b])
            )

            for (const tag of Object.values(BrandingImageTag)) {
                const currentImage = imagesMap.get(tag)
                const url = currentImage?.url
                const brandingKey = tag?.toLowerCase() + 'ImageURL'

                if (Object.keys(result).includes(brandingKey)) {
                    result[brandingKey as keyof BrandingResult] = url
                }
            }
        }

        // Safe branding in DB
        await BrandingStorer.call(
            organizationId,
            iconImage?.file,
            brandingImagesInfo,
            primaryColor,
            this.connection
        )

        return result
    }

    public async deleteBrandingImage(
        args: deleteBrandingImageInput,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return false
        }

        const { organizationId, type } = args

        await context.permissions.rejectIfNotAllowedMany(
            organizationId,
            [
                PermissionName.edit_this_organization_10330,
                PermissionName.edit_my_organization_10331,
            ],
            'OR'
        )
        const organizationBranding = await Branding.findOne({
            where: {
                organization: { organization_id: organizationId },
                status: Status.ACTIVE,
            },
        })

        // Organization has not branding
        if (!organizationBranding) {
            const errorDetails: CustomError = {
                code: BrandingErrorConstants.ERR_BRANDING_NONE_EXIST,
                message: BrandingErrorConstants.MSG_BRANDING_NONE_EXIST,
                params: { organizationId },
            }

            throw new BrandingError(errorDetails)
        }

        const imageToRemove = await BrandingImage.findOne({
            where: {
                branding: organizationBranding,
                tag: type,
                status: Status.ACTIVE,
            },
        })

        // Branding has not images of the given type
        if (!imageToRemove) {
            const errorDetails: CustomError = {
                code: BrandingErrorConstants.ERR_IMAGE_BRANDING_NONE_EXIST,
                message: BrandingErrorConstants.MSG_IMAGE_BRANDING_NONE_EXIST,
                params: { organizationId, type },
            }

            throw new BrandingError(errorDetails)
        }

        imageToRemove.status = Status.INACTIVE
        await BrandingImage.save(imageToRemove)

        return true
    }

    public async deleteBrandingColor(
        args: DeleteBrandingColorInput,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organizationId = args.organizationId

        await context.permissions.rejectIfNotAllowedMany(
            organizationId,
            [
                PermissionName.edit_this_organization_10330,
                PermissionName.edit_my_organization_10331,
            ],
            'OR'
        )
        const organizationBranding = await Branding.findOne({
            where: {
                organization: { organization_id: organizationId },
            },
        })

        // Organization has no branding
        if (!organizationBranding) {
            const errorDetails: CustomError = {
                code: BrandingErrorConstants.ERR_BRANDING_NONE_EXIST,
                message: BrandingErrorConstants.MSG_BRANDING_NONE_EXIST,
                params: { organizationId },
            }

            throw new BrandingError(errorDetails)
        }

        organizationBranding.primaryColor = null
        await Branding.save(organizationBranding)

        return true
    }
}
