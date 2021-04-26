import {
    createConnection,
    Connection,
    getManager,
    getRepository,
    EntityManager,
    Repository,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { User } from './entities/user'
import {
    Organization,
    validateDOB,
    validateEmail,
    validatePhone,
    padShortDob,
} from './entities/organization'
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
import { paginateData } from './utils/pagination/paginate'
import { processProgramFromCSVRow } from './utils/csv/program'
import { processAgeRangeFromCSVRow } from './utils/csv/ageRange'
import {
    renameNullOrganizations,
    renameDuplicatedOrganizations,
} from './utils/renameMigration/organization'

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
    private ageRangeRepository: Repository<AgeRange>

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
    }

    public async getMyUser({ token, permissions }: Context) {
        let userID = permissions.getUserId()
        let userEmail = token?.email
        let userPhone = token?.phone

        let user = await this.userRepository.findOne({
            where: [
                { email: userEmail, user_id: userID },
                { phone: userPhone, user_id: userID },
            ],
        })

        if (user) {
            return user
        }

        if (token?.id && userID != token?.id) {
            userID = token?.id
            user = await this.userRepository.findOne({
                where: [
                    { email: userEmail, user_id: userID },
                    { phone: userPhone, user_id: userID },
                ],
            })
        }

        if (user) {
            return user
        }

        if (userEmail && !validateEmail(userEmail)) {
            userEmail = undefined
        }
        if (userPhone && !validatePhone(userPhone)) {
            userPhone = undefined
        }

        if (userEmail || userPhone) {
            user = new User()
            user.user_id = uuid_v4()
            user.email = userEmail
            user.phone = userPhone

            await user.save()
        }

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
        alternate_email,
        alternate_phone,
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
        if (alternate_email && validateEmail(alternate_email)) {
            user.alternate_email = alternate_email
        }

        if (alternate_phone) {
            user.alternate_phone = alternate_phone
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

    public async usersConnection(
        context: Context,
        { direction, directionArgs, scope }: any
    ) {
        return paginateData({
            direction,
            directionArgs,
            scope,
            cursorColumn: 'user_id',
        })
    }

    public async permissionsConnection(
        context: Context,
        { direction, directionArgs }: any
    ) {
        const scope = this.permissionRepository.createQueryBuilder()

        return paginateData({
            direction,
            directionArgs,
            scope,
            cursorColumn: 'permission_id',
        })
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

    public async getAgeRange({ id, scope }: any, context: Context) {
        const ageRange = await scope
            .andWhere('AgeRange.id = :id', {
                id: id,
            })
            .getOne()

        return ageRange
    }

    public async getGrade({ id, scope }: any, context: Context) {
        const grade = await scope
            .andWhere('Grade.id = :id', {
                id: id,
            })
            .getOne()

        return grade
    }

    public async getCategory({ id, scope }: any, context: Context) {
        const category = await scope
            .andWhere('Category.id = :id', {
                id: id,
            })
            .getOne()

        return category
    }

    public async getProgram({ id, scope }: any, context: Context) {
        const program = await scope
            .andWhere('Program.id = :id', {
                id: id,
            })
            .getOne()

        return program
    }

    public async getSubcategory({ id, scope }: any, context: Context) {
        const subcategory = await scope
            .andWhere('Subcategory.id = :id', {
                id: id,
            })
            .getOne()

        return subcategory
    }

    public async getSubject({ id, scope }: any, context: Context) {
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
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processOrganizationFromCSVRow,
        ])

        return file
    }

    public async uploadUsersFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processUserFromCSVRow,
        ])

        return file
    }

    public async uploadClassesFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processClassFromCSVRow,
        ])

        return file
    }

    public async uploadSchoolsFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }
        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processSchoolFromCSVRow,
        ])

        return file
    }

    public async uploadGradesFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processGradeFromCSVRow,
            setGradeFromToFields,
        ])

        return file
    }

    public async uploadSubCategoriesFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processSubCategoriesFromCSVRow,
        ])

        return file
    }

    public async uploadRolesFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processRoleFromCSVRow,
        ])

        return file
    }

    public async uploadCategoriesFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processCategoryFromCSVRow,
        ])

        return file
    }

    public async uploadSubjectsFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processSubjectFromCSVRow,
        ])

        return file
    }

    public async uploadProgramsFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processProgramFromCSVRow,
        ])

        return file
    }

    public async uploadAgeRangesFromCSV(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (info.operation.operation !== 'mutation') {
            return null
        }

        const { file } = await args.file
        await createEntityFromCsvWithRollBack(this.connection, file, [
            processAgeRangeFromCSVRow,
        ])

        return file
    }

    public async renameDuplicateOrganizations(
        args: any,
        context: Context,
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
}
