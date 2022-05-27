import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'
import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import {
    createTestConnection,
    TestConnection,
} from '../../../utils/testConnection'
import { Organization } from '../../../../src/entities/organization'
import { Program } from '../../../../src/entities/program'
import { School } from '../../../../src/entities/school'
import { Class } from '../../../../src/entities/class'
import { createOrganization } from '../../../factories/organization.factory'
import { createProgram } from '../../../factories/program.factory'
import { createSchool } from '../../../factories/school.factory'
import { processClassFromCSVRow } from '../../../../src/utils/csv/class'
import { ClassRow } from '../../../../src/types/csv/classRow'
import { CSVError } from '../../../../src/types/csv/csvError'
import { createClass } from '../../../factories/class.factory'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { config } from '../../../../src/config/config'
import { createAcademicTerm } from '../../../factories/academicTerm.factory'
import { AcademicTerm } from '../../../../src/entities/academicTerm'
import { customErrors } from '../../../../src/types/errors/customError'
import { transactionalContext } from '../../hooks'
import { createAdminUser as createAdminUserFactory } from '../../../factories/user.factory'

use(chaiAsPromised)

describe('processClassFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: ClassRow

    let expectedOrg: Organization
    let secondOrg: Organization
    let expectedClass: Class
    let expectedProg: Program
    let expectedNoneProg: Program
    let expectedSystemProg: Program
    let expectedSchool: School
    let expectedSchool2: School
    let secondSchool: School
    let fileErrors: CSVError[]

    let adminUser: User
    let adminPermissions: UserPermissions

    const orgName = 'my-org'
    const secondOrgName = 'second-org'
    const school1Name = 'test-school'
    const school2Name = 'test-school2'
    const shortcodeDuplicatedSchoolName = 'duplicated-school'
    const secondSchoolName = 'second-school'
    const progName = 'outdoor activities'
    const systemProgName = 'Bada Read'
    const noneProgName = 'None Specified'
    const className = 'Class Test'

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })

        fileErrors = []

        expectedOrg = createOrganization()
        expectedOrg.organization_name = orgName
        await connection.manager.save(expectedOrg)

        secondOrg = createOrganization()
        secondOrg.organization_name = secondOrgName
        await connection.manager.save(secondOrg)

        expectedProg = createProgram(expectedOrg)
        expectedProg.name = progName
        await connection.manager.save(expectedProg)

        expectedSystemProg = createProgram()
        expectedSystemProg.organization = undefined
        expectedSystemProg.name = systemProgName
        expectedSystemProg.system = true
        await connection.manager.save(expectedSystemProg)

        expectedNoneProg = createProgram()
        expectedNoneProg.organization = undefined
        expectedNoneProg.name = noneProgName
        expectedNoneProg.system = true
        await connection.manager.save(expectedNoneProg)

        expectedSchool = createSchool(expectedOrg, school1Name)
        await connection.manager.save(expectedSchool)

        expectedSchool2 = createSchool(expectedOrg, school2Name)
        await connection.manager.save(expectedSchool2)

        secondSchool = createSchool(secondOrg, secondSchoolName)
        await connection.manager.save(secondSchool)

        expectedClass = createClass([], expectedOrg)
        expectedClass.class_name = className
        await connection.manager.save(expectedClass)
    })

    it('should create a class with school and program when present', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class1',
            school_name: school1Name,
            program_name: progName,
        }
        await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        const dbClass = await Class.findOneByOrFail({
            class_name: 'class1',
            organization: { organization_id: expectedOrg.organization_id },
        })
        const schools = (await dbClass.schools) || []
        const programs = (await dbClass.programs) || []

        expect(schools.length).to.equal(1)
        expect(programs.length).to.equal(1)
    })

    it('should create a class with specified shortcode and system program', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class2',
            class_shortcode: '3XABK3ZZS1',
            school_name: school1Name,
            program_name: systemProgName,
        }
        await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        const dbClass = await Class.findOneByOrFail({
            class_name: 'class2',
            organization: { organization_id: expectedOrg.organization_id },
        })

        const schools = (await dbClass.schools) || []
        const programs = (await dbClass.programs) || []

        expect(dbClass.shortcode).to.equal('3XABK3ZZS1')
        expect(schools.length).to.equal(1)
        expect(programs.length).to.equal(1)
        expect(programs[0].name).to.equal('Bada Read')
    })

    it('should create a class with no school and none specified program', async () => {
        row = { organization_name: orgName, class_name: 'class3' }
        await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        const dbClass = await Class.findOneByOrFail({
            class_name: 'class3',
            organization: { organization_id: expectedOrg.organization_id },
        })
        const schools = (await dbClass.schools) || []
        const programs = (await dbClass.programs) || []

        expect(schools.length).to.equal(0)
        expect(programs.length).to.equal(1)
        expect(programs[0].name).to.equal(noneProgName)
    })

    it('should create a class with a school and a program', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class4',
            class_shortcode: '3XABK3ZZS1',
            school_name: school1Name,
            program_name: progName,
        }
        await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        const dbClass = await Class.findOneByOrFail({
            class_name: 'class4',
            organization: { organization_id: expectedOrg.organization_id },
        })
        const schools = (await dbClass.schools) || []
        const programs = (await dbClass.programs) || []

        expect(schools.length).to.equal(1)
        expect(programs.length).to.equal(1)
    })

    it('should create a class with a duplicated shortcode from other organization', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class40',
            class_shortcode: secondSchool.shortcode,
        }
        await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        const dbClass = await Class.findOneByOrFail({
            class_name: 'class40',
            organization: { organization_id: expectedOrg.organization_id },
        })
        const organizationInClass = await dbClass.organization

        expect(dbClass).to.exist
        expect(dbClass.class_name).eq(row.class_name)
        expect(dbClass.shortcode).eq(row.class_shortcode)
        expect(dbClass.status).eq('active')
        expect(organizationInClass?.organization_name).eq(row.organization_name)
    })

    it('should record an error for missing org name', async () => {
        row = {
            organization_name: '',
            class_name: 'class5',
            class_shortcode: '3XABK3ZZS1',
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(
            customErrors.missing_required_entity_attribute.code
        )
        expect(classRowError.message).to.equal(
            'On row number 1, organization name is required.'
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should record an error for missing class name', async () => {
        row = {
            organization_name: orgName,
            class_name: '',
            class_shortcode: '3XABK3ZZS1',
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(
            customErrors.missing_required_entity_attribute.code
        )
        expect(classRowError.message).to.equal(
            'On row number 1, class name is required.'
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should record an error for invalid class name', async () => {
        row = {
            organization_name: orgName,
            class_name: '!nv@l!d n@m€',
            class_shortcode: 'CODE123',
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]
        expect(classRowError.code).to.equal(
            'ERR_INVALID_ALPHANUMERIC_SPECIAL_CHARACTERS'
        )
        expect(classRowError.message).to.equal(
            "On row number 1, class name must only contain letters, numbers, space and & / , - . '"
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should record an error for long shortcode', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            class_shortcode: 'L0NG5H0R7C02D3',
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]
        expect(classRowError.code).to.equal(
            'ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX'
        )
        expect(classRowError.message).to.equal(
            'On row number 1, class shortcode must only contain uppercase letters, numbers and must not greater than 10 characters.'
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should record an error for invalid shortcode', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            class_shortcode: '¢Ø₫€',
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]
        expect(classRowError.code).to.equal(
            'ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX'
        )
        expect(classRowError.message).to.equal(
            'On row number 1, class shortcode must only contain uppercase letters, numbers and must not greater than 10 characters.'
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for duplicated shortcode', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            class_shortcode: expectedClass.shortcode,
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(
            customErrors.existent_child_entity.code
        )
        expect(classRowError.message).to.equal(
            `On row number 1, shortcode ${expectedClass.shortcode} already exists for class ${expectedClass.class_name}.`
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for class name that exceeds max length', async () => {
        row = {
            organization_name: orgName,
            class_name: 'a'.repeat(config.limits.CLASS_NAME_MAX_LENGTH + 1),
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(
            customErrors.invalid_max_length.code
        )
        expect(classRowError.message).to.equal(
            `On row number 1, class name must not be greater than ${config.limits.CLASS_NAME_MAX_LENGTH} characters.`
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })
    // source code isn't checking for blank spaces, thus this test is skipped
    it.skip('should throw an error for class name composed of just blank spaces', async () => {
        row = {
            organization_name: orgName,
            class_name: '          ',
            school_name: school1Name,
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]
        expect(classRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED') //Not sure which code this should be
        expect(classRowError.message).to.equal(
            'On row number 1, class name is required.' //Same comment as above
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for invalid school', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            school_name: 'some-school',
            program_name: progName,
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(customErrors.nonexistent_child.code)
        expect(classRowError.message).to.equal(
            `On row number 1, school ${row.school_name} doesn't exist for organization ${orgName}.`
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for invalid program', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            school_name: school1Name,
            program_name: 'some-prog',
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(customErrors.nonexistent_child.code)
        expect(classRowError.message).to.equal(
            `On row number 1, program ${row.program_name} doesn't exist for organization ${orgName}.`
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for already created class', async () => {
        row = {
            organization_name: orgName,
            class_name: className,
            school_name: school1Name,
            program_name: 'some-prog',
        }
        const rowErrors = await processClassFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const classRowError = rowErrors[0]

        expect(classRowError.code).to.equal(customErrors.existent_entity.code)
        expect(classRowError.message).to.equal(
            `On row number 1, class ${className} already exists.`
        )

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    context('academic term', () => {
        let academicTerm: AcademicTerm

        beforeEach(async () => {
            academicTerm = await createAcademicTerm(secondSchool, {
                name: 'test academic term',
            }).save()
        })

        it('should return an error if the academic term is for a different school then the class', async () => {
            row = {
                organization_name: orgName,
                class_name: 'class1',
                school_name: expectedSchool.school_name,
                academic_term_name: academicTerm.name,
            }
            const rowErrors = await processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const classRowError = rowErrors[0]

            expect(classRowError.code).to.equal(
                customErrors.nonexistent_child.code
            )
            expect(classRowError.message).to.equal(
                `On row number 1, AcademicTerm ${academicTerm.name} doesn't exist for School ${expectedSchool.school_name}.`
            )

            const dbClass = await Class.find()
            expect(dbClass.length).to.equal(1)
        })

        it('should return an error if the academic term does not exist', async () => {
            row = {
                organization_name: orgName,
                class_name: 'class1',
                school_name: expectedSchool.school_name,
                academic_term_name: 'not a real academic term',
            }
            const rowErrors = await processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const classRowError = rowErrors[0]

            expect(classRowError.code).to.equal(
                customErrors.nonexistent_entity.code
            )
            expect(classRowError.message).to.equal(
                `On row number 1, AcademicTerm ${row.academic_term_name} doesn't exist or you don't have permissions to view it.`
            )

            const dbClass = await Class.find()
            expect(dbClass.length).to.equal(1)
        })

        it('should return an error if class has no school', async () => {
            row = {
                organization_name: orgName,
                class_name: 'class1',
                school_name: undefined,
                academic_term_name: academicTerm.name,
            }
            const rowErrors = await processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const classRowError = rowErrors[0]
            expect(classRowError.code).to.equal(
                customErrors.must_have_exactly_n.code
            )
            expect(classRowError.message).to.equal(
                'On row number 1, Class class1 must have exactly 1 School.'
            )

            const dbClass = await Class.find()
            expect(dbClass.length).to.equal(1)
        })

        it('should return an error if class has more then one school', async () => {
            // this needs to use a dedicated connection because
            // it tests the case where a class is not commited to the DB
            // but does already exist in the CSV transaction,
            // having been created by a previous row
            // This does not work in the test setup with the defaut connection
            // as it relies on $entity.find not using the CSV transaction
            // and so not seeing uncommited class entities
            transactionalContext.restoreCreateQueryRunner()
            const connectionForThisTest = await createTestConnection({
                name:
                    'should return an error if class has more then one school',
                synchronize: false,
                drop: false,
            })

            // we must make these outside of a transaction as postgres does not
            // have an isolation level that uncommited writes to be seen in other transactions
            // (see "Dirty Read" in https://www.postgresql.org/docs/current/transaction-iso.html)
            // which also means we cannot see anything made in previous beforeEachs
            const expectedOrg = createOrganization()
            expectedOrg.organization_name = orgName
            await connectionForThisTest.manager.save(expectedOrg)

            const expectedSchool = createSchool(expectedOrg, school1Name)
            await connectionForThisTest.manager.save(expectedSchool)

            const expectedSchool2 = createSchool(expectedOrg, school2Name)
            await connectionForThisTest.manager.save(expectedSchool2)

            const adminUser = await createAdminUserFactory()
            await connectionForThisTest.manager.save(adminUser)

            const userPermissions = new UserPermissions({
                id: adminUser.user_id,
                email: adminUser.email,
            })

            const academicTerm = createAcademicTerm(expectedSchool)
            academicTerm.name = 'test academic term'
            await connectionForThisTest.manager.save(academicTerm)

            const queryRunner = connectionForThisTest.createQueryRunner()
            await queryRunner.connect()

            await queryRunner.startTransaction()

            const classFromPreviousRow = createClass(
                [expectedSchool, expectedSchool2],
                expectedOrg,
                undefined,
                'class1'
            )

            await queryRunner.manager.save(classFromPreviousRow)
            row = {
                organization_name: orgName,
                class_name: classFromPreviousRow.class_name!,
                school_name: undefined,
                academic_term_name: academicTerm.name,
            }
            const rowErrors = await processClassFromCSVRow(
                queryRunner.manager,
                row,
                1,
                fileErrors,
                userPermissions
            )

            expect(rowErrors).to.have.length(1)

            const classRowError = rowErrors[0]
            expect(classRowError.code).to.equal(
                customErrors.must_have_exactly_n.code
            )
            expect(classRowError.message).to.equal(
                `On row number 1, Class class1 must have exactly 1 School.`
            )

            await expect(classFromPreviousRow.academicTerm).to.eventually.be
                .null

            await queryRunner.rollbackTransaction()
            await queryRunner.release()

            // because these were created outside of the transaction
            // we have to clean them up ourselves
            await adminUser.remove()
            await academicTerm.remove()
            await expectedSchool2.remove()
            await expectedSchool.remove()
            await expectedOrg.remove()

            await connectionForThisTest.close()

            transactionalContext.disableQueryRunnerCreation()
        })
    })
})
