import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Category } from '../../../../src/entities/category'
import { Organization } from '../../../../src/entities/organization'
import { Subcategory } from '../../../../src/entities/subcategory'
import { Model } from '../../../../src/model'
import { CategoryRow } from '../../../../src/types/csv/categoryRow'
import { CSVError } from '../../../../src/types/csv/csvError'
import { createServer } from '../../../../src/utils/createServer'
import { processCategoryFromCSVRow } from '../../../../src/utils/csv/category'
import { createOrganization } from '../../../factories/organization.factory'
import { createSubcategory } from '../../../factories/subcategory.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { Status } from '../../../../src/entities/status'
import { customErrors } from '../../../../src/types/errors/customError'

use(chaiAsPromised)

describe('processCategoryFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: CategoryRow
    let organization: Organization
    let subcategory: Subcategory
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
            organization_name: 'Company 1',
            category_name: 'Category 1',
            subcategory_name: 'Subcategory 1',
        }
        fileErrors = []

        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })

        organization = await createOrganization()
        organization.organization_name = row.organization_name
        await connection.manager.save(organization)

        subcategory = await createSubcategory(organization)
        subcategory.name = row.subcategory_name
        await connection.manager.save(subcategory)
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('returns rowErrors containing an ERR_CSV_MISSING_REQUIRED code and appropriate message', async () => {
            const rowErrors = await processCategoryFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(rowErrors).to.have.length(1)

            const orgRowError = rowErrors[0]

            expect(orgRowError.code).to.equal(
                customErrors.missing_required_entity_attribute.code
            )
            expect(orgRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const category = await Category.findOne({
                where: {
                    name: row.category_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                },
            })

            expect(category).to.be.null
        })
    })

    context('when the category name is not provided', () => {
        beforeEach(() => {
            row = { ...row, category_name: '' }
        })

        it('throws an error', async () => {
            const rowErrors = await processCategoryFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const categoryRowError = rowErrors[0]

            expect(categoryRowError.code).to.equal(
                customErrors.missing_required_entity_attribute.code
            )
            expect(categoryRowError.message).to.equal(
                'On row number 1, category name is required.'
            )

            const category = await Category.findOne({
                where: {
                    name: row.category_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                },
            })

            expect(category).to.be.null
        })
    })

    context("when the provided organization doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 10' }
        })

        it('returns rowErrors containing an ERR_CSV_NONE_EXIST_ENTITY code and appropriate message', async () => {
            const rowErrors = await processCategoryFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const categoryRowError = rowErrors[0]

            expect(categoryRowError.code).to.equal(
                customErrors.nonexistent_entity.code
            )
            expect(categoryRowError.message).to.equal(
                `On row number 1, organization ${row.organization_name} doesn't exist or you don't have permissions to view it.`
            )

            const category = await Category.findOne({
                where: {
                    name: row.category_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                },
            })

            expect(category).to.be.null
        })
    })

    context("when the provided subcategory doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, subcategory_name: 'Non-Existent Subcategory' }
        })

        it('returns rowErrors containing an ERR_CSV_NONE_EXIST_ENTITY code and appropriate message', async () => {
            const rowErrors = await processCategoryFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const categoryRowError = rowErrors[0]

            expect(categoryRowError.code).to.equal(
                customErrors.nonexistent_entity.code
            )
            expect(categoryRowError.message).to.equal(
                `On row number 1, subCategory ${row.subcategory_name} doesn't exist or you don't have permissions to view it.`
            )

            const category = await Category.findOne({
                where: {
                    name: row.category_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                },
            })

            expect(category).to.be.null
        })
    })

    context(
        'when the provided subcategory already exists in the current category',
        () => {
            beforeEach(async () => {
                const subcategories: Subcategory[] = []
                subcategories.push(subcategory)

                const category = new Category()
                category.name = row.category_name
                category.organization = Promise.resolve(organization)
                category.subcategories = Promise.resolve(subcategories)
                await connection.manager.save(category)
            })

            it('returns rowErrors containing an ERR_CSV_DUPLICATE_CHILD_ENTITY code and appropriate message', async () => {
                const rowErrors = await processCategoryFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const categoryRowError = rowErrors[0]

                expect(categoryRowError.code).to.equal(
                    customErrors.existent_child_entity.code
                )
                expect(categoryRowError.message).to.equal(
                    `On row number 1, subCategory ${subcategory.name} already exists for category Category 1.`
                )

                const category = await Category.findOne({
                    where: {
                        name: row.category_name,
                        status: Status.ACTIVE,
                        system: false,
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })

                expect(category).to.exist
            })
        }
    )

    context('when all data provided is valid', () => {
        context('and subcategory name is provided', () => {
            it('creates a category with its relations', async () => {
                await processCategoryFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const category = await Category.findOneOrFail({
                    where: {
                        name: row.category_name,
                        status: Status.ACTIVE,
                        system: false,
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })

                const organizationInCategory = await category.organization
                const subcategoriesInCategory =
                    (await category.subcategories) || []

                expect(category).to.exist
                expect(category.name).eq(row.category_name)
                expect(category.system).eq(false)
                expect(category.status).eq('active')
                expect(organizationInCategory?.organization_name).eq(
                    row.organization_name
                )
                expect(subcategoriesInCategory[0].name).eq(row.subcategory_name)
            })
        })

        context('and subcategory name is not provided', () => {
            beforeEach(async () => {
                const noneSpecified = new Subcategory()
                noneSpecified.name = 'None Specified'
                noneSpecified.system = true
                await connection.manager.save(noneSpecified)

                row = {
                    ...row,
                    category_name: 'Category 2',
                    subcategory_name: '',
                }
            })

            it('creates a category with None Specified subcategory', async () => {
                await processCategoryFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const category = await Category.findOneOrFail({
                    where: {
                        name: row.category_name,
                        status: Status.ACTIVE,
                        system: false,
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })

                const organizationInCategory = await category.organization
                const subcategoriesInCategory =
                    (await category.subcategories) || []

                expect(category).to.exist
                expect(category.name).eq(row.category_name)
                expect(category.system).eq(false)
                expect(category.status).eq('active')
                expect(organizationInCategory?.organization_name).eq(
                    row.organization_name
                )
                expect(subcategoriesInCategory[0].name).eq('None Specified')
            })
        })
    })
})
