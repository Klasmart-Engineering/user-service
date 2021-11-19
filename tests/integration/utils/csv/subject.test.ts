import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, getManager } from 'typeorm'
import { Organization } from '../../../../src/entities/organization'
import { Category } from '../../../../src/entities/category'
import { Subject } from '../../../../src/entities/subject'
import { Model } from '../../../../src/model'
import { SubjectRow } from '../../../../src/types/csv/subjectRow'
import { createServer } from '../../../../src/utils/createServer'
import { processSubjectFromCSVRow } from '../../../../src/utils/csv/subject'
import { createOrganization } from '../../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createTestConnection } from '../../../utils/testConnection'
import CategoriesInitializer from '../../../../src/initializers/categories'
import SubcategoriesInitializer from '../../../../src/initializers/subcategories'
import { CSVError } from '../../../../src/types/csv/csvError'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'

describe('processSubjectFromCSVRow', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let row: SubjectRow
    let organization: Organization
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await SubcategoriesInitializer.run()
        await CategoriesInitializer.run()
        organization = createOrganization()
        organization.organization_name = 'Company 1'
        await connection.manager.save(organization)

        row = {
            organization_name: 'Company 1',
            subject_name: 'Wacking',
            category_name: 'Gross Motor Skills',
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

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSubjectFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const subRowError = rowErrors[0]
            expect(subRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(subRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const subject = await Subject.findOne({
                where: {
                    name: row.subject_name,
                    status: 'active',
                    system: false,
                    organization: organization,
                },
            })

            expect(subject).to.be.undefined
        })
    })

    context('when the subject name is not provided', () => {
        beforeEach(() => {
            row = { ...row, subject_name: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSubjectFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const subRowError = rowErrors[0]
            expect(subRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(subRowError.message).to.equal(
                'On row number 1, subject name is required.'
            )

            const subject = await Subject.findOne({
                where: {
                    name: row.subject_name,
                    status: 'active',
                    system: false,
                    organization: organization,
                },
            })

            expect(subject).to.be.undefined
        })
    })

    context('when the category name is not provided', () => {
        beforeEach(() => {
            row = { ...row, category_name: '' }
        })

        it("succeeds with the 'None Specified' category", async () => {
            await processSubjectFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const subject = await Subject.findOne({
                where: {
                    name: row.subject_name,
                    status: 'active',
                    system: false,
                    organization: organization,
                },
            })
            const organizationInSubject = await subject?.organization

            expect(subject).to.exist
            const categories = await subject?.categories

            expect(subject?.name).eq(row.subject_name)
            expect(subject?.system).eq(false)
            expect(subject?.status).eq('active')
            expect(categories).to.exist
            expect(categories?.length).to.equal(1)
            const category = categories ? categories[0] : undefined
            expect(category?.name).to.equal('None Specified')
            expect(organizationInSubject?.organization_name).eq(
                row.organization_name
            )
        })
    })

    context("when the provided organization doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 10' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSubjectFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const subRowError = rowErrors[0]
            expect(subRowError.code).to.equal('ERR_CSV_INVALID_MULTIPLE_EXIST')
            expect(subRowError.message).to.equal(
                `On row number 1, "${row.organization_name}" organization matches 0, it should match one organization.`
            )

            const subject = await Subject.findOne({
                where: {
                    name: row.subject_name,
                    status: 'active',
                    system: false,
                    organization: organization,
                },
            })

            expect(subject).to.be.undefined
        })
    })

    context("when the provided category name doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, category_name: 'a non-existent category' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSubjectFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const subRowError = rowErrors[0]
            expect(subRowError.code).to.equal('ERR_CSV_NONE_EXIST_CHILD_ENTITY')
            expect(subRowError.message).to.equal(
                `On row number 1, "${row.category_name}" category doesn't exist for "${row.organization_name}" organization.`
            )

            const subject = await Subject.findOne({
                where: {
                    name: row.subject_name,
                    status: 'active',
                    system: false,
                    organization: organization,
                },
            })

            expect(subject).to.be.undefined
        })
    })

    context(
        'when the provided category already exists in the current subject',
        () => {
            beforeEach(async () => {
                const categories: Category[] = []
                const categoryFound = await Category.findOneOrFail({
                    where: {
                        name: row.category_name,
                    },
                })
                const subject = new Subject()

                categories.push(categoryFound)
                subject.name = row.subject_name
                subject.organization = Promise.resolve(organization)
                subject.categories = Promise.resolve(categories)
                await connection.manager.save(subject)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processSubjectFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                expect(rowErrors).to.have.length(1)

                const subRowError = rowErrors[0]
                expect(subRowError.code).to.equal(
                    'ERR_CSV_DUPLICATE_CHILD_ENTITY'
                )
                expect(subRowError.message).to.equal(
                    `On row number 1, "${row.category_name}" category already exists for "${row.subject_name}" subject.`
                )
            })
        }
    )

    context('when all data provided is valid', () => {
        it('creates the subjects with its relations', async () => {
            await processSubjectFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const subject = await Subject.findOneOrFail({
                where: {
                    name: row.subject_name,
                    status: 'active',
                    system: false,
                },
            })

            const organizationInSubject = await subject.organization

            expect(subject).to.exist
            expect(subject.name).eq(row.subject_name)
            expect(subject.system).eq(false)
            expect(subject.status).eq('active')
            expect(organizationInSubject?.organization_name).eq(
                row.organization_name
            )
        })
    })
})
