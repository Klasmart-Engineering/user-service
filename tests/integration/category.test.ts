import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { before } from 'mocha'
import { Connection } from 'typeorm'
import { Category } from '../../src/entities/category'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { Subcategory } from '../../src/entities/subcategory'
import { User } from '../../src/entities/user'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { Model } from '../../src/model'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    createCategories,
    createCategoryDuplicateAPIError,
    createCategoryDuplicateInputAPIError,
} from '../../src/resolvers/category'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import {
    CategoryConnectionNode,
    CreateCategoryInput,
} from '../../src/types/graphQL/category'
import { createServer } from '../../src/utils/createServer'
import {
    createInputLengthAPIError,
    createNonExistentOrInactiveEntityAPIError,
    createUnauthorizedOrganizationAPIError,
    MAX_MUTATION_INPUT_ARRAY_SIZE,
} from '../../src/utils/resolvers'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createAdminUser, createUser } from '../factories/user.factory'
import { NIL_UUID } from '../utils/database'
import { userToPayload } from '../utils/operations/userOps'
import { createTestConnection } from '../utils/testConnection'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

const buildContext = async (permissions: UserPermissions) => {
    return {
        permissions,
    }
}

describe('category', () => {
    let connection: Connection
    let admin: User
    let userWithPermission: User
    let userWithoutPermission: User
    let userWithoutMembership: User
    let org1: Organization
    let org2: Organization
    let createCategoriesRole: Role
    let subcategoriesToAdd: Subcategory[]

    before(async () => {
        connection = await createTestConnection()
        await createServer(new Model(connection))
    })

    beforeEach(async () => {
        await SubcategoriesInitializer.run()
        subcategoriesToAdd = await Subcategory.find({ take: 3 })

        // Creating Users
        admin = await createAdminUser().save()
        userWithPermission = await createUser().save()
        userWithoutPermission = await createUser().save()
        userWithoutMembership = await createUser().save()

        // Creating Organizations
        org1 = createOrganization()
        org1.organization_name = 'Organization 1'
        await org1.save()
        org2 = createOrganization()
        org2.organization_name = 'Organization 2'
        await org2.save()

        // Creating Role for create categories
        createCategoriesRole = await createRole('Create Categories', org1, {
            permissions: [PermissionName.create_subjects_20227],
        }).save()

        // Assigning userWithPermission to org1 with the createCategoriesRole
        await createOrganizationMembership({
            user: userWithPermission,
            organization: org1,
            roles: [createCategoriesRole],
        }).save()

        // Assigning userWithoutPermission to org1
        await createOrganizationMembership({
            user: userWithoutPermission,
            organization: org1,
        }).save()
    })

    after(async () => {
        await connection.close()
    })

    context('createCategories', () => {
        const createCategoriesFromResolver = async (
            user: User,
            input: CreateCategoryInput[]
        ) => {
            const permission = new UserPermissions(userToPayload(user))
            const ctx = await buildContext(permission)
            const result = await createCategories({ input }, ctx)

            return result
        }

        const buildCreateCategoryInput = (
            name: string,
            org: Organization,
            subcats?: Subcategory[]
        ) => {
            return {
                name,
                organizationId: org.organization_id,
                subcategories: subcats?.map((s) => s.id),
            }
        }

        const generateInput = (
            size: number,
            org: Organization,
            includeSubcategories: boolean
        ) => {
            return Array.from(Array(size), (_, i) =>
                buildCreateCategoryInput(
                    `Category ${i + 1}`,
                    org,
                    includeSubcategories ? subcategoriesToAdd : undefined
                )
            )
        }

        const findCategoriesByInput = async (
            input: CreateCategoryInput[]
        ): Promise<CreateCategoryInput[]> => {
            const categories = await Category.createQueryBuilder('Category')
                .select([
                    'Category.name',
                    'Organization.organization_id',
                    'Subcategories.id',
                ])
                .innerJoin('Category.organization', 'Organization')
                .innerJoin('Category.subcategories', 'Subcategories')
                .where('Category.name IN (:...inputNames)', {
                    inputNames: input.map((i) => i.name),
                })
                .andWhere('Organization.organization_id IN (:...inputOrgIds)', {
                    inputOrgIds: input.map((i) => i.organizationId),
                })
                .orderBy('Category.name')
                .addOrderBy('Organization.organization_name')
                .getMany()

            return categories.map((c) => {
                return {
                    name: c.name as string,
                    organizationId: (c as any).__organization__
                        .organization_id as string,
                    subcategories: (c as any).__subcategories__.map(
                        (s: Subcategory) => s.id
                    ),
                }
            })
        }

        const expectCategoriesCreated = async (
            user: User,
            input: CreateCategoryInput[]
        ) => {
            const { categories } = await createCategoriesFromResolver(
                user,
                input
            )

            expect(categories.length).to.eq(input.length)

            const inputNames = input.map((i) => i.name)
            const categoriesCreatedNames = categories.map(
                (cc: CategoryConnectionNode) => cc.name
            )
            expect(categoriesCreatedNames).to.deep.equalInAnyOrder(inputNames)

            const categoriesDB = await findCategoriesByInput(input)
            categoriesDB.forEach(async (cdb, i) => {
                expect(cdb.name).to.include(input[i].name)
                expect(cdb.organizationId).to.eq(input[i].organizationId)
                expect(cdb.subcategories).to.deep.equalInAnyOrder(
                    input[i].subcategories
                )
            })
        }

        const expectErrorCollection = async (
            user: User,
            input: CreateCategoryInput[],
            expectedErrors: APIError[]
        ) => {
            const operation = createCategoriesFromResolver(user, input)

            const { errors } = (await expect(operation).to.be
                .rejected) as APIErrorCollection

            expect(errors).to.exist
            expect(errors).to.be.an('array')
            errors.forEach((e, i) => {
                compareErrors(e, expectedErrors[i])
            })
        }

        const expectAPIError = async (
            user: User,
            input: CreateCategoryInput[],
            expectedError: APIError
        ) => {
            const operation = createCategoriesFromResolver(user, input)
            const error = (await expect(operation).to.be.rejected) as APIError

            expect(error).to.exist
            compareErrors(error, expectedError)
        }

        const expectCategories = async (quantity: number) => {
            const categoryCount = await Category.count()
            expect(categoryCount).to.eq(quantity)
        }

        const compareErrors = (error: APIError, expectedError: APIError) => {
            expect(error.code).to.eq(expectedError.code)
            expect(error.message).to.eq(expectedError.message)
            expect(error.variables).to.deep.equalInAnyOrder(
                expectedError.variables
            )
            expect(error.entity).to.eq(expectedError.entity)
            expect(error.entityName).to.eq(expectedError.entityName)
            expect(error.attribute).to.eq(expectedError.attribute)
            expect(error.otherAttribute).to.eq(expectedError.otherAttribute)
            expect(error.index).to.eq(expectedError.index)
            expect(error.min).to.eq(expectedError.min)
            expect(error.max).to.eq(expectedError.max)
        }

        context('when user is admin', () => {
            it('should create categories in any organization', async () => {
                const input = [
                    ...generateInput(1, org1, true),
                    ...generateInput(1, org2, true),
                ]

                await expectCategoriesCreated(admin, input)
            })
        })

        context('when user is not admin but has permission', () => {
            it('should create categories in the organization which belongs', async () => {
                const input = generateInput(2, org1, true)
                await expectCategoriesCreated(userWithPermission, input)
            })
        })

        context('when subcategories are not provided', () => {
            it('should create categories without subcategories', async () => {
                const input = generateInput(2, org1, false)
                await expectCategoriesCreated(admin, input)
            })
        })

        context('error handling', () => {
            context(
                'when non admin tries to create categories in an organization which does not belong',
                () => {
                    it('throws an ErrorCollection', async () => {
                        const input = generateInput(2, org2, true)
                        const expectedErrors = Array.from(input, (i, index) =>
                            createUnauthorizedOrganizationAPIError(
                                index,
                                i.organizationId
                            )
                        )

                        await expectErrorCollection(
                            userWithPermission,
                            input,
                            expectedErrors
                        )

                        await expectCategories(0)
                    })
                }
            )

            context(
                'when a user without permission tries to create categories in the organization which belongs',
                () => {
                    it('throws an ErrorCollection', async () => {
                        const input = generateInput(2, org1, true)
                        const expectedErrors = Array.from(input, (i, index) =>
                            createUnauthorizedOrganizationAPIError(
                                index,
                                i.organizationId
                            )
                        )

                        await expectErrorCollection(
                            userWithoutPermission,
                            input,
                            expectedErrors
                        )

                        await expectCategories(0)
                    })
                }
            )

            context(
                'when non member tries to create categories in any organization',
                () => {
                    it('throws an ErrorCollection', async () => {
                        const input = [
                            ...generateInput(1, org1, true),
                            ...generateInput(1, org2, true),
                        ]

                        const expectedErrors = Array.from(input, (i, index) =>
                            createUnauthorizedOrganizationAPIError(
                                index,
                                i.organizationId
                            )
                        )

                        await expectErrorCollection(
                            userWithoutMembership,
                            input,
                            expectedErrors
                        )

                        await expectCategories(0)
                    })
                }
            )

            context('when user sends an empty array as input', () => {
                it('throws an APIError', async () => {
                    const expectedError = createInputLengthAPIError(
                        'Category',
                        'min'
                    )

                    await expectAPIError(
                        admin,
                        generateInput(0, org1, true),
                        expectedError
                    )

                    await expectCategories(0)
                })
            })

            context(
                `when user tries to create more than ${MAX_MUTATION_INPUT_ARRAY_SIZE} categories`,
                () => {
                    it('throws an APIError', async () => {
                        const expectedError = createInputLengthAPIError(
                            'Category',
                            'max'
                        )

                        await expectAPIError(
                            admin,
                            generateInput(
                                MAX_MUTATION_INPUT_ARRAY_SIZE + 1,
                                org1,
                                true
                            ),
                            expectedError
                        )

                        await expectCategories(0)
                    })
                }
            )

            context(
                'when user tries to create categories in an organization which does not exist',
                () => {
                    it('throws an ErrorCollection', async () => {
                        const subcategoryIds = subcategoriesToAdd.map(
                            (s) => s.id
                        )

                        const input = Array.from(Array(2), (_, i) => {
                            return {
                                name: `Category ${i + 1}`,
                                organizationId: NIL_UUID,
                                subcategories: subcategoryIds,
                            }
                        })

                        const expectedErrors = Array.from(input, (i, index) =>
                            createNonExistentOrInactiveEntityAPIError(
                                index,
                                ['organization_id'],
                                'ID',
                                'Organization',
                                i.organizationId
                            )
                        )

                        await expectErrorCollection(
                            admin,
                            input,
                            expectedErrors
                        )

                        await expectCategories(0)
                    })
                }
            )

            context(
                'when user tries to create categories adding subcategories which does not exist',
                () => {
                    it('throws an ErrorCollection', async () => {
                        const input = Array.from(Array(2), (_, i) => {
                            return {
                                name: `Category ${i + 1}`,
                                organizationId: org1.organization_id,
                                subcategories: [NIL_UUID],
                            }
                        })

                        const expectedErrors = Array.from(input, (i, index) =>
                            createNonExistentOrInactiveEntityAPIError(
                                index,
                                ['id'],
                                'IDs',
                                'Subcategory',
                                i.subcategories.toString()
                            )
                        )

                        await expectErrorCollection(
                            admin,
                            input,
                            expectedErrors
                        )

                        await expectCategories(0)
                    })
                }
            )

            context('when the categories to create are duplicated', () => {
                it('throws an ErrorCollection', async () => {
                    const input = [
                        ...generateInput(1, org1, true),
                        ...generateInput(1, org1, true),
                    ]

                    const expectedErrors = Array.from(input, (_, index) =>
                        createCategoryDuplicateInputAPIError(
                            index,
                            ['organizationId', 'name'],
                            'CreateCategoryInput',
                            'organizationId and name combination'
                        )
                    )

                    // The first input is not really duplicated
                    expectedErrors.shift()

                    await expectErrorCollection(admin, input, expectedErrors)
                    await expectCategories(0)
                })
            })

            context('when the category to create already exists', () => {
                let input: CreateCategoryInput[]

                beforeEach(async () => {
                    input = generateInput(1, org1, true)
                    await createCategoriesFromResolver(admin, input)
                })

                it('throws an ErrorCollection', async () => {
                    const expectedErrors = Array.from(input, (i, index) =>
                        createCategoryDuplicateAPIError(
                            index,
                            i.name,
                            i.organizationId
                        )
                    )

                    await expectErrorCollection(admin, input, expectedErrors)

                    // The already existent category is the only expected
                    await expectCategories(1)
                })
            })
        })
    })
})
