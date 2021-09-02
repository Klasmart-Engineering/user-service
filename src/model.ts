import {
    createConnection,
    Connection,
    getManager,
    getRepository,
    EntityManager,
    Repository,
    SelectQueryBuilder,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { User } from './entities/user'
import { OrganizationMembership } from './entities/organizationMembership'
import { SchoolMembership } from './entities/schoolMembership'
import { Organization, padShortDob } from './entities/organization'
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
import { processUserFromCSVRow } from './utils/csv/user'
import { processClassFromCSVRow } from './utils/csv/class'
import { createEntityFromCsvWithRollBack } from './utils/csv/importEntity'
import { processGradeFromCSVRow, setGradeFromToFields } from './utils/csv/grade'
import { processOrganizationFromCSVRow } from './utils/csv/organization'
import { processSchoolFromCSVRow } from './utils/csv/school'
import { processSubCategoriesFromCSVRow } from './utils/csv/subCategories'
import { processRoleFromCSVRow } from './utils/csv/role'
import { processCategoryFromCSVRow } from './utils/csv/category'
import { processSubjectFromCSVRow } from './utils/csv/subject'
import { paginateData, IPaginationArgs } from './utils/pagination/paginate'
import { processProgramFromCSVRow } from './utils/csv/program'
import { processAgeRangeFromCSVRow } from './utils/csv/ageRange'
import {
    renameNullOrganizations,
    renameDuplicatedOrganizations,
} from './utils/renameMigration/organization'
import {
    getWhereClauseFromFilter,
    filterHasProperty,
    AVOID_NONE_SPECIFIED_BRACKETS,
} from './utils/pagination/filtering'
import { UserConnectionNode } from './types/graphQL/userConnectionNode'
import { isDOB, isEmail, isPhone } from './utils/validations'
import { ISchoolsConnectionNode } from './types/graphQL/schoolsConnectionNode'
import { renameDuplicatedSubjects } from './utils/renameMigration/subjects'
import { Program } from './entities/program'
import { ProgramConnectionNode } from './types/graphQL/programConnectionNode'
import { renameDuplicatedGrades } from './utils/renameMigration/grade'
import { Grade } from './entities/grade'
import { Category } from './entities/category'
import { Subcategory } from './entities/subcategory'
import { Subject } from './entities/subject'
import { Upload } from './types/upload'
import { setBrandingInput } from './types/graphQL/setBrandingInput'
import { GradeConnectionNode } from './types/graphQL/gradeConnectionNode'
import { BrandingResult, BrandingImageInfo } from './types/graphQL/branding'
import { BrandingStorer } from './services/brandingStorer'
import { CloudStorageUploader } from './services/cloudStorageUploader'
import { BrandingImageTag } from './types/graphQL/brandingImageTag'
import { buildFilePath } from './utils/storage'
import { Branding } from './entities/branding'
import { CustomError } from './types/errors/customError'
import BrandingErrorConstants from './types/errors/branding/brandingErrorConstants'
import { BrandingError } from './types/errors/branding/brandingError'
import { BrandingImage } from './entities/brandingImage'
import { deleteBrandingImageInput } from './types/graphQL/deleteBrandingImageInput'
import { Status } from './entities/status'
import { AgeRangeConnectionNode } from './types/graphQL/ageRangeConnectionNode'
import { ClassConnectionNode } from './types/graphQL/classConnectionNode'
import { SubjectConnectionNode } from './types/graphQL/subjectConnectionNode'
import { runMigrations } from './initializers/migrations'

export class Model {
    public static async create() {
        try {
            const connection = await createConnection({
                name: 'default',
                type: 'postgres',
                url:
                    process.env.DATABASE_URL ||
                    'postgres://postgres:kidsloop@localhost',
                synchronize: false,
                logging: Boolean(process.env.DATABASE_LOGGING),
                entities: ['src/entities/*.ts'],
                migrations: ['migrations/*.ts'],
            })

            await runMigrations(connection)

            const model = new Model(connection)
            await getManager(connection.name).query(
                'CREATE EXTENSION IF NOT EXISTS pg_trgm'
            )
            await model.createOrUpdateSystemEntities()
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

    public async getMyUser({ token, permissions }: Context) {
        const user_id = permissions.getUserId()
        if (!user_id) {
            return undefined
        }

        const email = token?.email
        const phone = token?.phone

        const user = await this.userRepository.findOne({
            where: [
                { email, user_id },
                { phone, user_id },
            ],
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
        console.info('Unauthenticated endpoint call newUser')

        const newUser = new User()
        if (email) {
            if (!isEmail(email)) {
                email = undefined
            }
        }
        if (phone) {
            if (!isPhone(phone)) {
                phone = undefined
            }
        }
        if (date_of_birth) {
            date_of_birth = padShortDob(date_of_birth)
            if (!isDOB(date_of_birth)) {
                date_of_birth = undefined
            }
        }
        if (!(email ?? phone)) {
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
        console.info('Unauthenticated endpoint call setUser')
        if (email) {
            if (!isEmail(email)) {
                email = undefined
            }
        }
        if (phone) {
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
        user.alternate_phone = clean.phone(alternate_phone)

        await this.manager.save(user)
        return user
    }
    public async getUser(user_id: string) {
        console.info('Unauthenticated endpoint call getUser')

        const user = await this.userRepository.findOneOrFail(user_id)
        return user
    }

    public async myUsers(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const userEmail = context.token?.email
        const userPhone = context.token?.phone
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
        if (userEmail) {
            users = await scope
                .andWhere('User.email = :email', {
                    email: userEmail,
                })
                .getMany()
        } else if (userPhone) {
            users = await scope
                .andWhere('User.phone = :phone', {
                    phone: userPhone,
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

    public async usersConnection(
        context: Context,
        { direction, directionArgs, scope, filter, sort }: IPaginationArgs<User>
    ) {
        scope.leftJoinAndSelect('User.memberships', 'OrgMembership')
        if (filter) {
            if (filterHasProperty('roleId', filter)) {
                scope.innerJoinAndSelect(
                    'OrgMembership.roles',
                    'RoleMembershipsOrganizationMembership'
                )
            }
            if (filterHasProperty('schoolId', filter)) {
                scope.leftJoinAndSelect(
                    'User.school_memberships',
                    'SchoolMembership'
                )
            }
            if (filterHasProperty('classId', filter)) {
                scope.leftJoin('User.classesStudying', 'ClassStudying')
                scope.leftJoin('User.classesTeaching', 'ClassTeaching')
            }
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    organizationId: 'OrgMembership.organization_id',
                    organizationUserStatus: 'OrgMembership.status',
                    userId: "concat(User.user_id, '')",
                    phone: 'User.phone',
                    schoolId: 'SchoolMembership.school_id',
                    classId: {
                        operator: 'OR',
                        aliases: [
                            'ClassStudying.class_id',
                            'ClassTeaching.class_id',
                        ],
                    },
                })
            )
        }

        const data = await paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'user_id',
                aliases: {
                    givenName: 'given_name',
                    familyName: 'family_name',
                },
                sort,
            },
        })
        for (const edge of data.edges) {
            const user = edge.node as User
            const newNode: Partial<UserConnectionNode> = {
                id: user.user_id,
                givenName: user.given_name,
                familyName: user.family_name,
                avatar: user.avatar,
                status: user.status,
                contactInfo: {
                    email: user.email,
                    phone: user.phone,
                },
                alternateContactInfo: {
                    email: user.alternate_email,
                    phone: user.alternate_phone,
                },
                // other properties have dedicated resolvers that use Dataloader
            }

            edge.node = newNode
        }

        return data
    }

    public async permissionsConnection(
        context: Context,
        { direction, directionArgs, filter }: IPaginationArgs<Permission>
    ) {
        const scope = this.permissionRepository.createQueryBuilder()

        if (filter) {
            scope.andWhere(getWhereClauseFromFilter(filter))
        }

        return paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'permission_id',
            },
        })
    }

    public async schoolsConnection(
        context: Context,
        {
            direction,
            directionArgs,
            scope,
            filter,
            sort,
        }: IPaginationArgs<School>
    ) {
        if (filter) {
            if (filterHasProperty('organizationId', filter)) {
                scope.leftJoinAndSelect('School.organization', 'Organization')
            }
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    organizationId: 'Organization.organization_id',
                    schoolId: 'school_id',
                    name: 'school_name',
                    shortCode: 'shortcode',
                    status: 'School.status', // not organization status!
                })
            )
        }

        const data = await paginateData<School>({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'school_id',
                aliases: {
                    id: 'school_id',
                    name: 'school_name',
                    shortCode: 'shortcode',
                },
                sort,
            },
        })

        for (const edge of data.edges) {
            const school = edge.node
            const newNode: ISchoolsConnectionNode = {
                id: school.school_id,
                name: school.school_name,
                status: school.status,
                shortCode: school.shortcode,
                organizationId:
                    (await school.organization)?.organization_id || '',
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            edge.node = newNode as any
        }

        return data
    }

    public async programsConnection(
        _context: Context,
        {
            direction,
            directionArgs,
            scope,
            filter,
            sort,
        }: IPaginationArgs<Program>
    ) {
        if (filter) {
            if (filterHasProperty('organizationId', filter)) {
                scope.leftJoinAndSelect('Program.organization', 'Organization')
            }

            if (filterHasProperty('gradeId', filter)) {
                scope.leftJoinAndSelect('Program.grades', 'Grade')
            }

            if (
                filterHasProperty('ageRangeFrom', filter) ||
                filterHasProperty('ageRangeTo', filter)
            ) {
                scope
                    .leftJoinAndSelect('Program.age_ranges', 'AgeRange')
                    .where(AVOID_NONE_SPECIFIED_BRACKETS)
            }

            if (filterHasProperty('subjectId', filter)) {
                scope.leftJoinAndSelect('Program.subjects', 'Subject')
            }

            if (filterHasProperty('schoolId', filter)) {
                scope.leftJoinAndSelect('Program.schools', 'School')
            }

            if (filterHasProperty('classId', filter)) {
                scope.leftJoin('Program.classes', 'Class')
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    id: 'Program.id',
                    name: 'Program.name',
                    system: 'Program.system',
                    status: 'Program.status',
                    organizationId: 'Organization.organization_id',
                    gradeId: 'Grade.id',
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                    ageRangeTo: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.high_value',
                            'AgeRange.high_value_unit',
                        ],
                    },
                    subjectId: 'Subject.id',
                    schoolId: 'School.school_id',
                    classId: 'Class.class_id',
                })
            )
        }

        const data = await paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'id',
                aliases: {
                    id: 'id',
                    name: 'name',
                },
                sort,
            },
        })

        for (const edge of data.edges) {
            const program = edge.node as Program
            const newNode: Partial<ProgramConnectionNode> = {
                id: program.id,
                name: program.name,
                status: program.status,
                system: program.system,
                // other properties have dedicated resolvers that use Dataloader
            }

            edge.node = newNode
        }

        return data
    }

    public async gradesConnection(
        _context: Context,
        {
            direction,
            directionArgs,
            scope,
            filter,
            sort,
        }: IPaginationArgs<Grade>
    ) {
        if (filter) {
            if (filterHasProperty('organizationId', filter)) {
                scope.leftJoinAndSelect('Grade.organization', 'Organization')
            }

            if (filterHasProperty('fromGradeId', filter)) {
                scope.leftJoinAndSelect(
                    'Grade.progress_from_grade',
                    'FromGrade'
                )
            }

            if (filterHasProperty('toGradeId', filter)) {
                scope.leftJoinAndSelect('Grade.progress_to_grade', 'ToGrade')
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    id: 'Grade.id',
                    name: 'Grade.name',
                    system: 'Grade.system',
                    status: 'Grade.status',
                    organizationId: 'Organization.organization_id',
                    fromGradeId: 'FromGrade.id',
                    toGradeId: 'ToGrade.id',
                })
            )
        }

        const data = await paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'id',
                aliases: {
                    id: 'id',
                    name: 'name',
                },
                sort,
            },
        })

        for (const edge of data.edges) {
            const grade = edge.node as Grade
            const newNode: Partial<GradeConnectionNode> = {
                id: grade.id,
                name: grade.name,
                status: grade.status,
                system: grade.system,
                // other properties have dedicated resolvers that use Dataloader
            }

            edge.node = newNode
        }

        return data
    }

    public async ageRangesConnection(
        _context: Context,
        {
            direction,
            directionArgs,
            scope,
            filter,
            sort,
        }: IPaginationArgs<AgeRange>
    ) {
        if (filter) {
            if (filterHasProperty('organizationId', filter)) {
                scope.leftJoinAndSelect('AgeRange.organization', 'Organization')
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeValueFrom: 'AgeRange.low_value',
                    ageRangeUnitFrom: 'AgeRange.low_value_unit',
                    ageRangeValueTo: 'AgeRange.high_value',
                    ageRangeUnitTo: 'AgeRange.high_value_unit',
                    system: 'AgeRange.system',
                    status: 'AgeRange.status',
                    organizationId: 'Organization.organization_id',
                })
            )
        }

        const data = await paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'id',
                aliases: {
                    id: 'id',
                    lowValue: 'low_value',
                    lowValueUnit: 'low_value_unit',
                },
                sort,
            },
        })

        for (const edge of data.edges) {
            const ageRange = edge.node as AgeRange
            const newNode: Partial<AgeRangeConnectionNode> = {
                id: ageRange.id,
                name: ageRange.name,
                status: ageRange.status,
                system: ageRange.system,
                lowValue: ageRange.low_value,
                lowValueUnit: ageRange.low_value_unit,
                highValue: ageRange.high_value,
                highValueUnit: ageRange.high_value_unit,
            }

            edge.node = newNode
        }

        return data
    }

    public async classesConnection(
        _context: Context,
        {
            direction,
            directionArgs,
            scope,
            filter,
            sort,
        }: IPaginationArgs<Class>
    ) {
        if (filter) {
            if (filterHasProperty('organizationId', filter)) {
                scope.leftJoinAndSelect('Class.organization', 'Organization')
            }

            if (
                filterHasProperty('ageRangeValueFrom', filter) ||
                filterHasProperty('ageRangeUnitFrom', filter) ||
                filterHasProperty('ageRangeValueTo', filter) ||
                filterHasProperty('ageRangeUnitTo', filter)
            ) {
                scope
                    .leftJoinAndSelect('Class.age_ranges', 'AgeRange')
                    .where(AVOID_NONE_SPECIFIED_BRACKETS)
            }

            if (filterHasProperty('schoolId', filter)) {
                scope.leftJoinAndSelect('Class.schools', 'School')
            }

            if (filterHasProperty('gradeId', filter)) {
                scope.leftJoinAndSelect('Class.grades', 'Grade')
            }

            if (filterHasProperty('subjectId', filter)) {
                scope.leftJoinAndSelect('Class.subjects', 'Subject')
            }

            if (filterHasProperty('programId', filter)) {
                scope.leftJoinAndSelect('Class.programs', 'Program')
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    id: 'Class.class_id',
                    name: 'Class.class_name',
                    status: 'Class.status',
                    organizationId: 'Organization.organization_id',
                    ageRangeValueFrom: 'AgeRange.low_value',
                    ageRangeUnitFrom: 'AgeRange.low_value_unit',
                    ageRangeValueTo: 'AgeRange.high_value',
                    ageRangeUnitTo: 'AgeRange.high_value_unit',
                    schoolId: 'School.school_id',
                    gradeId: 'Grade.id',
                    subjectId: 'Subject.id',
                    programId: 'Program.id',
                })
            )
        }

        const data = await paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'class_id',
                aliases: {
                    id: 'class_id',
                    name: 'class_name',
                },
                sort,
            },
        })

        for (const edge of data.edges) {
            const class_ = edge.node as Class
            const newNode: Partial<ClassConnectionNode> = {
                id: class_.class_id,
                name: class_.class_name,
                status: class_.status,
                // other properties have dedicated resolvers that use Dataloader
            }

            edge.node = newNode
        }

        return data
    }

    public async subjectsConnection(
        _context: Context,
        {
            direction,
            directionArgs,
            scope,
            filter,
            sort,
        }: IPaginationArgs<Subject>
    ) {
        if (filter) {
            if (filterHasProperty('organizationId', filter)) {
                scope.leftJoinAndSelect('Subject.organization', 'Organization')
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    status: 'Subject.status',
                    system: 'Subject.system',
                    organizationId: 'Organization.organization_id',
                })
            )
        }

        const data = await paginateData({
            direction,
            directionArgs,
            scope,
            sort: {
                primaryKey: 'id',
                aliases: {
                    id: 'id',
                    name: 'name',
                    system: 'system',
                },
                sort,
            },
        })

        for (const edge of data.edges) {
            const subject = edge.node as Subject
            const newNode: Partial<SubjectConnectionNode> = {
                id: subject.id,
                name: subject.name,
                status: subject.status,
                system: subject.system,
                // other properties have dedicated resolvers that use Dataloader
            }

            edge.node = newNode
        }

        return data
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

    public async uploadOrganizationsFromCSV(
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
            [processOrganizationFromCSVRow],
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
            [processUserFromCSVRow],
            context.permissions,
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
            [processClassFromCSVRow],
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
            [processSchoolFromCSVRow],
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
            [processGradeFromCSVRow, setGradeFromToFields],
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
            [processSubCategoriesFromCSVRow],
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
            [processRoleFromCSVRow],
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
            [processCategoryFromCSVRow],
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
            [processSubjectFromCSVRow],
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
            [processProgramFromCSVRow],
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
            [processAgeRangeFromCSVRow],
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
        const iconImage = await args.iconImage
        const primaryColor = args.primaryColor
        const organizationId = args.organizationId

        const result: BrandingResult = {
            iconImageURL: undefined,
            primaryColor: primaryColor,
        }

        const brandingImagesInfo: BrandingImageInfo[] = []

        // Here we should build an image per tag
        if (iconImage) {
            const file = iconImage.file

            for (const tag of [BrandingImageTag.ICON]) {
                // Build path for image
                const remoteFilePath = buildFilePath(
                    organizationId,
                    file.filename,
                    'organizations',
                    tag.toLowerCase()
                )

                // Upload image to cloud
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
                const brandingKey = (tag.toLowerCase() +
                    'ImageURL') as keyof BrandingResult
                result[brandingKey] = remoteUrl
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
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organizationId = args.organizationId
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
