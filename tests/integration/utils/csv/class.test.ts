import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'

import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createTestConnection } from '../../../utils/testConnection'
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

use(chaiAsPromised)

describe('processClassFromCSVRow', () => {
    let connection: Connection
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
    let expectedShortcodeDuplicatedSchool: School
    let secondSchool: School
    let fileErrors: CSVError[] = []

    let adminUser: User
    let adminPermissions: UserPermissions

    const orgName: string = 'my-org'
    const secondOrgName: string = 'second-org'
    const school1Name: string = 'test-school'
    const school2Name: string = 'test-school2'
    const shortcodeDuplicatedSchoolName: string = 'duplicated-school'
    const secondSchoolName: string = 'second-school'
    const progName: string = 'outdoor activities'
    const systemProgName: string = 'Bada Read'
    const noneProgName: string = 'None Specified'
    const className: string = 'Class Test'

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    beforeEach(async () => {
        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })

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

        expectedShortcodeDuplicatedSchool = createSchool(
            expectedOrg,
            shortcodeDuplicatedSchoolName
        )
        await connection.manager.save(expectedShortcodeDuplicatedSchool)

        secondSchool = createSchool(secondOrg, secondSchoolName)
        await connection.manager.save(secondSchool)

        expectedClass = createClass([], expectedOrg)
        expectedClass.class_name = className
        await connection.manager.save(expectedClass)
    })

    after(async () => {
        await connection?.close()
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

        const dbClass = await Class.findOneOrFail({
            where: { class_name: 'class1', organization: expectedOrg },
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

        const dbClass = await Class.findOneOrFail({
            where: { class_name: 'class2', organization: expectedOrg },
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

        const dbClass = await Class.findOneOrFail({
            where: { class_name: 'class3', organization: expectedOrg },
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

        const dbClass = await Class.findOneOrFail({
            where: { class_name: 'class4', organization: expectedOrg },
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

        const dbClass = await Class.findOneOrFail({
            where: { class_name: 'class40', organization: expectedOrg },
        })
        const organizationInClass = await dbClass.organization

        expect(dbClass).to.exist
        expect(dbClass.class_name).eq(row.class_name)
        expect(dbClass.shortcode).eq(row.class_shortcode)
        expect(dbClass.status).eq('active')
        expect(organizationInClass?.organization_name).eq(row.organization_name)
    })

    it('should throw an error (missing org/classname) and rollback when all transactions', async () => {
        row = {
            organization_name: '',
            class_name: 'class5',
            class_shortcode: '3XABK3ZZS1',
            school_name: school1Name,
            program_name: progName,
        }
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected
        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for long shortcode', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            class_shortcode: 'L0NG5H0R7C02D3',
            school_name: school1Name,
            program_name: progName,
        }
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected
        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for invalid shortcode', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            class_shortcode: '¢Ø₫€',
            school_name: school1Name,
            program_name: progName,
        }
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected
        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for duplicated shortcode', async () => {
        row = {
            organization_name: orgName,
            class_name: 'class5',
            class_shortcode: expectedShortcodeDuplicatedSchool.shortcode,
            school_name: school1Name,
            program_name: progName,
        }
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected
        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for class name length greater than 35 characters', async () => {
        row = {
            organization_name: orgName,
            class_name:
                'This is a class name with more than thirty five characters length',
            school_name: school1Name,
            program_name: progName,
        }
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })

    it('should throw an error for class name composed for just blank spaces', async () => {
        row = {
            organization_name: orgName,
            class_name: '          ',
            school_name: school1Name,
            program_name: progName,
        }
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected

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
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected

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
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected

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
        const fn = () =>
            processClassFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

        expect(fn()).to.be.rejected

        const dbClass = await Class.find()
        expect(dbClass.length).to.equal(1)
    })
})
