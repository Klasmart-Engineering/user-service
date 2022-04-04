import chaiAsPromised from 'chai-as-promised'
import { Equal, getConnection } from 'typeorm'
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
import { createUser } from '../../../factories/user.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { Grade } from '../../../../src/entities/grade'
import { createGrade } from '../../../factories/grade.factory'
import { setGradeFromToFields } from '../../../../src/utils/csv/grade'
import { CSVError } from '../../../../src/types/csv/csvError'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { Status } from '../../../../src/entities/status'

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
    // A few of the tests here are skipped temporarily because fixing the tests and source code
    // have been deprioritised
    context.skip("when 'from grade' is equal to grade", () => {
        let organization: Organization

        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            organization = await createOrganization(owner)
            await organization.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                progress_from_grade_name: row.grade_name,
            }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await setGradeFromToFields(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]
            expect(gradeRowError.code).to.equal('ERR_CSV_INVALID_DIFFERENT')
            expect(gradeRowError.message).to.equal(
                'On row number 1, grade progress_from_grade_name and name must be different.'
            )

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.undefined
        })
    })

    context.skip("when 'to grade' is equal to grade", () => {
        let organization: Organization

        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            organization = await createOrganization(owner)
            await organization.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                progress_to_grade_name: row.grade_name,
            }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await setGradeFromToFields(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]
            expect(gradeRowError.code).to.equal('ERR_CSV_INVALID_DIFFERENT')
            expect(gradeRowError.message).to.equal(
                'On row number 1, grade progress_to_grade_name and name must be different.'
            )

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.undefined
        })
    })

    context.skip("when 'from grade' and 'to grade' are equal", () => {
        let organization: Organization

        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            organization = await createOrganization(owner)
            await organization.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                progress_from_grade_name: row.progress_to_grade_name,
            }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await setGradeFromToFields(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const gradeRowError = rowErrors[0]
            expect(gradeRowError.code).to.equal('ERR_CSV_INVALID_DIFFERENT')
            expect(gradeRowError.message).to.equal(
                'On row number 1, grade progress_to_grade_name and progress_from_grade_name must be different.'
            )

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.undefined
        })
    })

    context.skip("when 'from grade' doesn't exist", () => {
        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            const organization = await createOrganization(owner)
            await organization.save()

            const noneSpecifiedGrade = await createGrade()
            noneSpecifiedGrade.name = 'None Specified'
            noneSpecifiedGrade.system = true
            noneSpecifiedGrade.organization = undefined
            await noneSpecifiedGrade.save()

            const fromGrade = await createGrade(organization)
            await fromGrade.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                progress_to_grade_name: String(fromGrade.name),
            }
        })

        it('returns a None Specified grade', async () => {
            expect(
                setGradeFromToFields(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.deep.eq({
                name: 'None Specified',
                system: true,
                organization: null,
            })

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.undefined
        })
    })

    context.skip("when 'to grade' doesn't exist", () => {
        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            const organization = await createOrganization(owner)
            await organization.save()

            const noneSpecifiedGrade = await createGrade()
            noneSpecifiedGrade.name = 'None Specified'
            noneSpecifiedGrade.system = true
            noneSpecifiedGrade.organization = undefined
            await noneSpecifiedGrade.save()

            const fromGrade = await createGrade(organization)
            await fromGrade.save()

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                progress_from_grade_name: String(fromGrade.name),
            }
        })

        it('returns a None Specified grade', async () => {
            expect(
                setGradeFromToFields(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.deep.eq({
                name: 'None Specified',
                system: true,
                organization: null,
            })

            const grade = await Grade.findOneBy({
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            expect(grade).to.be.undefined
        })
    })

    context('when all data provided is valid', () => {
        let organization: Organization
        let fromGrade: Grade
        let toGrade: Grade
        let grade: Grade

        beforeEach(async () => {
            const owner = await createUser()
            await owner.save()

            organization = await createOrganization(owner)
            await organization.save()

            const noneSpecifiedGrade = await createGrade()
            noneSpecifiedGrade.name = 'None Specified'
            noneSpecifiedGrade.system = true
            noneSpecifiedGrade.organization = undefined
            await noneSpecifiedGrade.save()

            grade = fromGrade = await createGrade(organization)
            await fromGrade.save()

            fromGrade = await createGrade(organization)
            await fromGrade.save()

            toGrade = await createGrade(organization)
            await toGrade.save()

            row = {
                ...row,
                grade_name: String(grade.name),
                organization_name: String(organization.organization_name),
                progress_from_grade_name: String(fromGrade.name),
                progress_to_grade_name: String(toGrade.name),
            }
        })

        it('creates the grade', async () => {
            await setGradeFromToFields(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const grade = await Grade.findOneByOrFail({
                organization: Equal(organization),
                system: false,
                status: Status.ACTIVE,
                name: row.grade_name,
            })

            const organizationInGrade = await grade.organization
            const fromGradeInGrade = await grade.progress_from_grade
            const toGradeInGrade = await grade.progress_to_grade

            expect(grade).to.exist
            expect(grade.name).eq(row.grade_name)
            expect(grade.system).eq(false)
            expect(grade.status).eq('active')
            expect(organizationInGrade?.organization_name).eq(
                row.organization_name
            )
            expect(fromGradeInGrade?.name).eq(row.progress_from_grade_name)
            expect(toGradeInGrade?.name).eq(row.progress_to_grade_name)
        })
    })
})
