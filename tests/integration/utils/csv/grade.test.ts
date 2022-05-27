import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'
import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { Organization } from '../../../../src/entities/organization'
import { GradeRow } from '../../../../src/types/csv/gradeRow'
import { processGradeFromCSVRow } from '../../../../src/utils/csv/grade'
import { createUser } from '../../../factories/user.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { Grade } from '../../../../src/entities/grade'
import { createGrade } from '../../../factories/grade.factory'
import { CSVError } from '../../../../src/types/csv/csvError'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { Status } from '../../../../src/entities/status'
import { customErrors } from '../../../../src/types/errors/customError'

use(chaiAsPromised)

describe('processGradeFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: GradeRow
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        row = {
            organization_name: 'Larson-Wyman',
            grade_name: 'First Grade',
            progress_from_grade_name: 'Kindergarten',
            progress_to_grade_name: 'Second Grade',
        }
        fileErrors = []

        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('records an appropriate error code and message', async () => {
            const rowErrors = await processGradeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]

            expect(gradeRowError.code).to.equal(
                customErrors.missing_required_entity_attribute.code
            )
            expect(gradeRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.null
        })
    })

    context('when the grade name is not provided', () => {
        beforeEach(async () => {
            row = { ...row, grade_name: '' }
        })

        it('records an appropriate error code and message', async () => {
            const rowErrors = await processGradeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]

            expect(gradeRowError.code).to.equal(
                customErrors.missing_required_entity_attribute.code
            )
            expect(gradeRowError.message).to.equal(
                'On row number 1, grade name is required.'
            )

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.null
        })
    })

    context("when the organization provided doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'I Do Not Exist' }
        })

        it('records an appropriate error code and message', async () => {
            const rowErrors = await processGradeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]

            expect(gradeRowError.code).to.equal(
                customErrors.nonexistent_entity.code
            )
            expect(gradeRowError.message).to.equal(
                `On row number 1, organization ${row.organization_name} doesn't exist or you don't have permissions to view it.`
            )

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.null
        })
    })

    context('when the provided grade already exists', () => {
        let organization: Organization

        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            organization = await createOrganization(owner)
            await organization.save()

            const grade = await createGrade(organization)
            await grade.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                grade_name: String(grade.name),
            }
        })

        it('records an appropriate error code and message', async () => {
            const rowErrors = await processGradeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]

            expect(gradeRowError.code).to.equal(
                customErrors.existent_child_entity.code
            )
            expect(gradeRowError.message).to.equal(
                `On row number 1, grade ${row.grade_name} already exists for organization ${row.organization_name}.`
            )

            const grade = await Grade.findOneBy({
                organization: { organization_id: organization.organization_id },
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.exist
        })
    })

    context('when all data provided is valid', () => {
        let organization: Organization

        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            organization = await createOrganization(owner)
            await organization.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
            }
        })

        it('creates the grade', async () => {
            await processGradeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const grade = await Grade.findOneByOrFail({
                organization: { organization_id: organization.organization_id },
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            const organizationInGrade = await grade.organization

            expect(grade).to.exist
            expect(grade.name).eq(row.grade_name)
            expect(grade.system).eq(false)
            expect(grade.status).eq('active')
            expect(organizationInGrade?.organization_name).eq(
                row.organization_name
            )
        })
    })
})
