import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { before } from 'mocha'
import { In, Not } from 'typeorm'
import { Category } from '../../src/entities/category'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { Status } from '../../src/entities/status'
import { Subcategory } from '../../src/entities/subcategory'
import { User } from '../../src/entities/user'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { Model } from '../../src/model'
import { categoryConnectionNodeFields } from '../../src/pagination/categoriesConnection'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    addSubcategoriesToCategories,
    createCategories,
    DeleteCategories,
    removeSubcategoriesFromCategories,
    updateCategories,
} from '../../src/resolvers/category'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import {
    AddSubcategoriesToCategoryInput,
    CategoriesMutationResult,
    CategoryConnectionNode,
    CreateCategoryInput,
    DeleteCategoryInput,
    RemoveSubcategoriesFromCategoryInput,
    UpdateCategoryInput,
} from '../../src/types/graphQL/category'
import { createServer } from '../../src/utils/createServer'
import { createCategory } from '../factories/category.factory'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    createInputRequiresAtLeastOne,
    createNonExistentOrInactiveEntityAPIError,
} from '../../src/utils/resolvers/errors'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createAdminUser, createUser } from '../factories/user.factory'
import { NIL_UUID, truncateTables } from '../utils/database'
import {
    buildRemoveSubcategoriesFromCategoryInputArray,
    buildSingleRemoveSubcategoriesFromCategoryInput,
    buildSingleUpdateCategoryInput,
    buildUpdateCategoryInputArray,
} from '../utils/operations/categoryOps'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { userToPayload } from '../utils/operations/userOps'
import { config } from '../../src/config/config'
import { customErrors } from '../../src/types/errors/customError'
import { createSubcategory } from '../factories/subcategory.factory'
import { Context } from '../../src/main'
import faker from 'faker'
import CategoriesInitializer from '../../src/initializers/categories'
import { buildDeleteCategoryInputArray } from '../utils/operations/categoryOps'
import { compareErrors } from '../utils/apiError'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { permErrorMeta } from '../utils/errors'
import RoleInitializer from '../../src/initializers/roles'
import {
    initialiseTestTransactions,
    runInTransaction
} from 'typeorm-test-transactions'


initialiseTestTransactions();

interface CategoryAndSubcategories {
    id: string
    name?: string
    __subcategories__?: { id: string }[]
}

type NoUpdateProp = 'name' | 'subcategories' | 'both'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

const expectAPIErrorCollection = async (
    resolverCall: Promise<any>,
    expectedErrors: APIErrorCollection
) => {
    const { errors } = (await expect(resolverCall).to.be
        .rejected) as APIErrorCollection
    expect(errors).to.exist
    for (let x = 0; x < errors.length; x++)
        compareErrors(errors[x], expectedErrors.errors[x])
}

const expectAPIError = async (
    resolverCall: Promise<any>,
    expectedError: APIError
) => {
    const error = (await expect(resolverCall).to.be.rejected) as APIError

    expect(error).to.exist
    compareErrors(error, expectedError)
}

describe('category', runInTransaction(async () => {
    let connection: TestConnection
    let admin: User
    let userWithPermission: User
    let userWithoutPermission: User
    let userWithoutMembership: User
    let org1: Organization
    let org2: Organization
    let systemCategories: Category[]
    let org1Categories: Category[]
    let org2Categories: Category[]
    let updateCategoriesRole: Role
    let createCategoriesRole: Role
    let deleteCategoriesRole: Role
    let subcategoriesToAdd: Subcategory[]
    let categoriesTotalCount = 0
    const categoriesCount = 5

    const expectCategories = async (quantity: number) => {
        const categoryCount = await Category.count({
            where: { status: Status.ACTIVE },
        })

        expect(categoryCount).to.eq(quantity)
    }

    const createInitialCategories = async () => {
        await CategoriesInitializer.run()
        systemCategories = await Category.find({ take: categoriesCount })

        org1Categories = await Category.save(
            Array.from(new Array(categoriesCount), () =>
                createCategory(org1, subcategoriesToAdd)
            )
        )

        org2Categories = await Category.save(
            Array.from(new Array(categoriesCount), () =>
                createCategory(org2, subcategoriesToAdd)
            )
        )

        categoriesTotalCount = await Category.count()
    }

    before(async () => {
        connection = await createTestConnection()
        await createServer(new Model(connection))

        await truncateTables(connection)
        UserPermissions.ADMIN_EMAILS = ['joe@gmail.com']

        faker.seed(123)
        await RoleInitializer.run()
    })

    after(async () => {
        await connection.close()
    })

    beforeEach(async () => {
        await SubcategoriesInitializer.run()
        subcategoriesToAdd = await Subcategory.find({
            take: 3,
            order: { id: 'ASC' },
        })

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

        // Creating Role for delete categories
        deleteCategoriesRole = await createRole('Delete Categories', org1, {
            permissions: [PermissionName.delete_subjects_20447],
        }).save()

        // Creating Role for update categories
        updateCategoriesRole = await createRole('Update Categories', org1, {
            permissions: [PermissionName.edit_subjects_20337],
        }).save()

        // Assigning userWithPermission to org1 with the createCategoriesRole
        await createOrganizationMembership({
            user: userWithPermission,
            organization: org1,
            roles: [
                createCategoriesRole,
                updateCategoriesRole,
                deleteCategoriesRole,
            ],
        }).save()

        // Assigning userWithoutPermission to org1
        await createOrganizationMembership({
            user: userWithoutPermission,
            organization: org1,
        }).save()
    })

    context('createCategories', () => {
        const createCategoriesFromResolver = async (
            user: User,
            input: CreateCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
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
            categoriesDB.forEach((cdb, i) => {
                expect(cdb.name).to.include(input[i].name)
                expect(cdb.organizationId).to.eq(input[i].organizationId)
                expect(cdb.subcategories).to.deep.equalInAnyOrder(
                    input[i].subcategories
                )
            })
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
            const permError = permErrorMeta(
                PermissionName.create_subjects_20227
            )

            context(
                'when non admin tries to create categories in an organization which does not belong',
                () => {
                    it('throws a permission error', async () => {
                        const user = userWithPermission
                        const input = generateInput(2, org2, true)
                        const operation = createCategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [org2])
                        )

                        await expectCategories(0)
                    })
                }
            )

            context(
                'when a user without permission tries to create categories in the organization which belongs',
                () => {
                    it('throws a permission error', async () => {
                        const user = userWithoutMembership
                        const input = generateInput(2, org1, true)
                        const operation = createCategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [org1])
                        )

                        await expectCategories(0)
                    })
                }
            )

            context(
                'when non member tries to create categories in any organization',
                () => {
                    it('throws a permission error', async () => {
                        const user = userWithoutMembership
                        const input = [
                            ...generateInput(1, org1, true),
                            ...generateInput(1, org2, true),
                        ]

                        const operation = createCategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [org1, org2])
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

                    const input = generateInput(0, org1, true)
                    const operation = createCategoriesFromResolver(admin, input)
                    await expectAPIError(operation, expectedError)
                    await expectCategories(0)
                })
            })

            context(
                `when user tries to create more than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE} categories`,
                () => {
                    it('throws an APIError', async () => {
                        const expectedError = createInputLengthAPIError(
                            'Category',
                            'max'
                        )

                        const input = generateInput(
                            config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1,
                            org1,
                            true
                        )

                        const operation = createCategoriesFromResolver(
                            admin,
                            input
                        )

                        await expectAPIError(operation, expectedError)
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

                        const operation = createCategoriesFromResolver(
                            admin,
                            input
                        )

                        const expectedErrors = Array.from(input, (i, index) =>
                            createNonExistentOrInactiveEntityAPIError(
                                index,
                                ['organization_id'],
                                'ID',
                                'Organization',
                                i.organizationId
                            )
                        )

                        await expectAPIErrorCollection(
                            operation,
                            new APIErrorCollection(expectedErrors)
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

                        const operation = createCategoriesFromResolver(
                            admin,
                            input
                        )

                        const expectedErrors = Array.from(input, (i, index) =>
                            createNonExistentOrInactiveEntityAPIError(
                                index,
                                ['id'],
                                'IDs',
                                'Subcategory',
                                i.subcategories.toString()
                            )
                        )

                        await expectAPIErrorCollection(
                            operation,
                            new APIErrorCollection(expectedErrors)
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
                        ...generateInput(1, org1, true),
                    ]

                    const expectedErrors = Array.from(
                        [input[1], input[2]],
                        (_, index) =>
                            createDuplicateAttributeAPIError(
                                index + 1,
                                ['organizationId', 'name'],
                                'CreateCategoryInput'
                            )
                    )

                    const operation = createCategoriesFromResolver(admin, input)
                    await expectAPIErrorCollection(
                        operation,
                        new APIErrorCollection(expectedErrors)
                    )

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
                        createEntityAPIError(
                            'existentChild',
                            index,
                            'Category',
                            i.name,
                            'Organization',
                            i.organizationId,
                            ['organization_id', 'name']
                        )
                    )

                    const operation = createCategoriesFromResolver(admin, input)
                    await expectAPIErrorCollection(
                        operation,
                        new APIErrorCollection(expectedErrors)
                    )

                    // The already existent category is the only expected
                    await expectCategories(1)
                })
            })
        })
    })

    context('updateCategories', () => {
        let subcategoriesForUpdate: Subcategory[]

        const updateCategoriesFromResolver = async (
            user: User,
            input: UpdateCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
            const result = await updateCategories({ input }, ctx)
            return result
        }

        const findCategoriesAndSubcategoriesByIds = async (
            ids: string[]
        ): Promise<UpdateCategoryInput[]> => {
            const categories = await Category.createQueryBuilder('Category')
                .select(['Category.id', 'Category.name', 'Subcategory.id'])
                .leftJoin('Category.subcategories', 'Subcategory')
                .where('Category.id IN (:...ids)', { ids })
                .getMany()

            return categories.map((c) => {
                return {
                    id: c.id,
                    name: c.name,
                    subcategories: (c as CategoryAndSubcategories).__subcategories__?.map(
                        (s) => s.id
                    ),
                }
            })
        }

        const expectCategoriesFromInput = async (
            user: User,
            input: UpdateCategoryInput[]
        ) => {
            const { categories } = await updateCategoriesFromResolver(
                user,
                input
            )

            expect(categories.length).to.eq(input.length)
            categories.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.name).to.eq(input[i].name)
            })

            const categoriesDB = await findCategoriesAndSubcategoriesByIds(
                input.map((i) => i.id)
            )

            expect(categoriesDB.length).to.eq(input.length)
            categoriesDB.forEach((cdb) => {
                const inputRelated = input.find((i) => i.id === cdb.id)
                expect(inputRelated).to.exist
                expect(cdb.name).to.eq(inputRelated?.name)
                expect(cdb.subcategories).to.deep.equalInAnyOrder(
                    inputRelated?.subcategories
                )
            })
        }

        const expectCategoriesFromCategories = async (
            user: User,
            categoriesToUpdate: Category[],
            noUpdate?: NoUpdateProp
        ) => {
            const avoidNames = noUpdate === 'name' || noUpdate === 'both'
            const avoidSubcategories =
                noUpdate === 'subcategories' || noUpdate === 'both'

            const input = buildUpdateCategoryInputArray(
                categoriesToUpdate.map((c) => c.id),
                avoidSubcategories
                    ? undefined
                    : subcategoriesForUpdate.map((s) => s.id),
                avoidNames
            )

            const { categories } = await updateCategoriesFromResolver(
                user,
                input
            )

            expect(categories.length).to.eq(input.length)
            categories.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.name).to.eq(
                    avoidNames ? categoriesToUpdate[i].name : input[i].name
                )
            })

            const categoriesDB = await findCategoriesAndSubcategoriesByIds(
                input.map((i) => i.id)
            )

            expect(categoriesDB.length).to.eq(input.length)

            for (const cdb of categoriesDB) {
                const inputRelated = input.find((i) => i.id === cdb.id)
                const categoryRelated = categoriesToUpdate.find(
                    (c) => c.id === cdb.id
                )

                expect(inputRelated).to.exist
                expect(categoryRelated).to.exist
                expect(cdb.name).to.eq(
                    avoidNames ? categoryRelated?.name : inputRelated?.name
                )
                expect(cdb.subcategories).to.deep.eq(
                    avoidSubcategories
                        ? (await categoryRelated?.subcategories)?.map(
                              (s) => s.id
                          )
                        : inputRelated?.subcategories
                )
            }
        }

        const expectNoChangesMade = async (categoriesToFind: Category[]) => {
            const ids = categoriesToFind.map((c) => c.id)
            const categoriesDB = await Category.createQueryBuilder('Category')
                .select([
                    ...categoryConnectionNodeFields,
                    ...(['id'] as (keyof Subcategory)[]).map(
                        (field) => `Subcategory.${field}`
                    ),
                ])
                .leftJoin('Category.subcategories', 'Subcategory')
                .where('Category.id IN (:...ids)', {
                    ids,
                })
                .getMany()

            const categoriesToFindSubcategories = categoriesToFind.map(
                async (c) => (await c.subcategories)?.map((s) => s.id)
            )

            expect(categoriesDB).to.exist
            expect(categoriesDB.length).to.eq(categoriesToFind.length)
            for (const [i, c] of categoriesToFind.entries()) {
                const categoryRelated = categoriesDB.find(
                    (cdb) => c.id === cdb.id
                )

                expect(categoryRelated?.name).to.eq(c.name)
                expect(categoryRelated?.status).to.eq(c.status)

                const categoryRelatedSubcategories = await categoryRelated?.subcategories

                expect(
                    await categoriesToFindSubcategories[i]
                ).to.deep.equalInAnyOrder(
                    categoryRelatedSubcategories?.map((s) => s.id)
                )
            }
        }

        beforeEach(async () => {
            await createInitialCategories()
            subcategoriesForUpdate = await Subcategory.find({
                take: 3,
                order: { id: 'DESC' },
            })
        })

        context('permissions', () => {
            context('successful cases', () => {
                context('when user is admin', () => {
                    it('should update any category', async () => {
                        await expectCategoriesFromCategories(admin, [
                            systemCategories[0],
                            org1Categories[0],
                            org2Categories[0],
                        ])
                    })
                })

                context('when user is not admin', () => {
                    context('but has permission', () => {
                        it('should update categories in its organization', async () => {
                            await expectCategoriesFromCategories(
                                userWithPermission,
                                org1Categories
                            )
                        })
                    })
                })
            })

            context('error handling', () => {
                const permError = permErrorMeta(
                    PermissionName.edit_subjects_20337
                )

                context('when user has permission', () => {
                    context('and tries to update system categories', () => {
                        it('throws a permission error', async () => {
                            const user = userWithPermission
                            const catsToUpdate = systemCategories
                            const input = buildUpdateCategoryInputArray(
                                catsToUpdate.map((c) => c.id),
                                subcategoriesForUpdate.map((s) => s.id)
                            )

                            const operation = updateCategoriesFromResolver(
                                user,
                                input
                            )

                            await expect(operation).to.be.rejectedWith(
                                permError(user)
                            )

                            await expectNoChangesMade(catsToUpdate)
                        })
                    })

                    context(
                        'and tries to update categories in a non belonging organization',
                        () => {
                            it('throws a permission error', async () => {
                                const user = userWithPermission
                                const catsToUpdate = org2Categories
                                const input = buildUpdateCategoryInputArray(
                                    catsToUpdate.map((c) => c.id),
                                    subcategoriesForUpdate.map((s) => s.id)
                                )

                                const operation = updateCategoriesFromResolver(
                                    user,
                                    input
                                )

                                await expect(operation).to.be.rejectedWith(
                                    permError(user, [org2])
                                )

                                await expectNoChangesMade(catsToUpdate)
                            })
                        }
                    )
                })

                context('when user has not permission', () => {
                    context('but has membership', () => {
                        context(
                            'and tries to update categories in its organization',
                            () => {
                                it('throws a permission error', async () => {
                                    const user = userWithoutPermission
                                    const catsToUpdate = org1Categories
                                    const input = buildUpdateCategoryInputArray(
                                        catsToUpdate.map((c) => c.id),
                                        subcategoriesForUpdate.map((s) => s.id)
                                    )

                                    const operation = updateCategoriesFromResolver(
                                        user,
                                        input
                                    )

                                    await expect(operation).to.be.rejectedWith(
                                        permError(user, [org1])
                                    )

                                    await expectNoChangesMade(catsToUpdate)
                                })
                            }
                        )
                    })

                    context('neither has membership', () => {
                        context('and tries to update any categories', () => {
                            it('throws a permission error', async () => {
                                const user = userWithoutMembership
                                const catsToUpdate = [
                                    systemCategories[0],
                                    org1Categories[0],
                                    org2Categories[0],
                                ]

                                const input = buildUpdateCategoryInputArray(
                                    catsToUpdate.map((c) => c.id),
                                    subcategoriesForUpdate.map((s) => s.id)
                                )

                                const operation = updateCategoriesFromResolver(
                                    user,
                                    input
                                )

                                await expect(operation).to.be.rejectedWith(
                                    permError(user)
                                )

                                await expectNoChangesMade(catsToUpdate)
                            })
                        })
                    })
                })
            })
        })

        context('inputs', () => {
            context('successful cases', () => {
                context(
                    'when the received name already exists in system categories',
                    () => {
                        it('should update the category', async () => {
                            const input = [
                                buildSingleUpdateCategoryInput(
                                    org1Categories[0].id,
                                    systemCategories[0].name,
                                    subcategoriesForUpdate.map((s) => s.id)
                                ),
                            ]

                            await expectCategoriesFromInput(admin, input)
                        })
                    }
                )

                context(
                    'when the received name already exists in another organization',
                    () => {
                        it('should update the category', async () => {
                            const input = [
                                buildSingleUpdateCategoryInput(
                                    org1Categories[0].id,
                                    org2Categories[0].name,
                                    subcategoriesForUpdate.map((s) => s.id)
                                ),
                            ]

                            await expectCategoriesFromInput(admin, input)
                        })
                    }
                )
                context('when just name is provided', () => {
                    it('should just update names', async () => {
                        await expectCategoriesFromCategories(
                            admin,
                            org1Categories,
                            'name'
                        )
                    })
                })

                context('when just subcategories are provided', () => {
                    it('should just update names', async () => {
                        await expectCategoriesFromCategories(
                            admin,
                            org1Categories,
                            'subcategories'
                        )
                    })
                })
            })

            context('error handling', () => {
                context('when input provided is an empty array', () => {
                    it('should throw an APIError', async () => {
                        const expectedError = createInputLengthAPIError(
                            'Category',
                            'min'
                        )

                        const input = buildUpdateCategoryInputArray([])
                        const operation = updateCategoriesFromResolver(
                            admin,
                            input
                        )

                        await expectAPIError(operation, expectedError)
                        // no expecting for no changes because nothing was sent
                    })
                })

                context(
                    `when input length is greater than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE}`,
                    () => {
                        it('should throw an APIError', async () => {
                            const categoryToUpdate = org1Categories[0]
                            const catsToUpdate = Array.from(
                                new Array(
                                    config.limits
                                        .MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                                ),
                                () => categoryToUpdate
                            )
                            const expectedError = createInputLengthAPIError(
                                'Category',
                                'max'
                            )

                            const input = buildUpdateCategoryInputArray(
                                catsToUpdate.map((c) => c.id)
                            )

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIError(operation, expectedError)
                            await expectNoChangesMade([categoryToUpdate])
                        })
                    }
                )

                context(
                    "when input provided has duplicates in 'id' field",
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const categoryToRepeat = org1Categories[0]
                            const input = Array.from(new Array(3), (_, i) =>
                                buildSingleUpdateCategoryInput(
                                    categoryToRepeat.id,
                                    `Renamed Category ${i + 1}`,
                                    subcategoriesForUpdate.map((s) => s.id)
                                )
                            )

                            const expectedErrors = Array.from(
                                [input[1], input[2]],
                                (_, index) => {
                                    return createDuplicateAttributeAPIError(
                                        index + 1,
                                        ['id'],
                                        'UpdateCategoryInput'
                                    )
                                }
                            )

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIErrorCollection(
                                operation,
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoChangesMade([categoryToRepeat])
                        })
                    }
                )

                context(
                    "when input provided has duplicates in 'name' field",
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catsToUpdate = org1Categories
                            const input = Array.from(catsToUpdate, (c, i) =>
                                buildSingleUpdateCategoryInput(
                                    c.id,
                                    'Renamed Category',
                                    subcategoriesForUpdate.map((s) => s.id)
                                )
                            )

                            const expectedErrors = Array.from(
                                catsToUpdate.slice(1, catsToUpdate.length),
                                (_, index) => {
                                    return createDuplicateAttributeAPIError(
                                        index + 1,
                                        ['name'],
                                        'UpdateCategoryInput'
                                    )
                                }
                            )

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIErrorCollection(
                                operation,
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoChangesMade(catsToUpdate)
                        })
                    }
                )

                context(
                    'when a category with the received id does not exist',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const existentCatsToUpdate = [
                                org1Categories[0],
                                org2Categories[0],
                            ]

                            const nonExistentCategoryId = NIL_UUID
                            const input = [
                                buildSingleUpdateCategoryInput(
                                    nonExistentCategoryId,
                                    'Renamed Category',
                                    subcategoriesForUpdate.map((s) => s.id)
                                ),
                                buildSingleUpdateCategoryInput(
                                    existentCatsToUpdate[0].id,
                                    'Renamed Category 2',
                                    subcategoriesForUpdate.map((s) => s.id)
                                ),
                                buildSingleUpdateCategoryInput(
                                    existentCatsToUpdate[1].id,
                                    'Renamed Category 3',
                                    subcategoriesForUpdate.map((s) => s.id)
                                ),
                            ]

                            const expectedErrors = [
                                createEntityAPIError(
                                    'nonExistent',
                                    0,
                                    'Category',
                                    nonExistentCategoryId
                                ),
                            ]

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIErrorCollection(
                                operation,
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoChangesMade(existentCatsToUpdate)
                        })
                    }
                )

                context('when the received category is inactive', () => {
                    let inactiveCategory: Category

                    beforeEach(async () => {
                        inactiveCategory = org1Categories[0]
                        inactiveCategory.status = Status.INACTIVE
                        await inactiveCategory.save()
                    })

                    it('should throw an ErrorCollection', async () => {
                        const catsToUpdate = org1Categories
                        const expectedErrors = Array.from(
                            catsToUpdate,
                            (_, index) => {
                                return createEntityAPIError(
                                    'inactive',
                                    index,
                                    'Category',
                                    inactiveCategory.id
                                )
                            }
                        )

                        const input = buildUpdateCategoryInputArray(
                            catsToUpdate.map((c) => c.id)
                        )

                        const operation = updateCategoriesFromResolver(
                            admin,
                            input
                        )

                        await expectAPIErrorCollection(
                            operation,
                            new APIErrorCollection(expectedErrors)
                        )

                        await expectNoChangesMade(catsToUpdate)
                    })
                })

                context(
                    'when the received name already exist in another category',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catsToUpdate = org1Categories.slice(0, 3)
                            const input = Array.from(catsToUpdate, (c, i) =>
                                buildSingleUpdateCategoryInput(
                                    c.id,
                                    org1Categories[i + 1].name,
                                    subcategoriesForUpdate.map((s) => s.id)
                                )
                            )

                            const expectedErrors = Array.from(
                                catsToUpdate,
                                (_, index) => {
                                    return createEntityAPIError(
                                        'existent',
                                        index,
                                        'Category',
                                        org1Categories[index + 1].name
                                    )
                                }
                            )

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIErrorCollection(
                                operation,
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoChangesMade(catsToUpdate)
                        })
                    }
                )

                context(
                    'when the received subcategories does not exist',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catsToUpdate = org1Categories
                            const missingSubcategoryIds = [NIL_UUID]
                            const input = Array.from(catsToUpdate, (c, i) =>
                                buildSingleUpdateCategoryInput(
                                    c.id,
                                    `Renamed Category ${i + 1}`,
                                    missingSubcategoryIds
                                )
                            )

                            const expectedErrors = Array.from(
                                input,
                                (_, index) => {
                                    return createNonExistentOrInactiveEntityAPIError(
                                        index,
                                        ['id'],
                                        'IDs',
                                        'Subcategory',
                                        missingSubcategoryIds.toString()
                                    )
                                }
                            )

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIErrorCollection(
                                operation,
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoChangesMade(catsToUpdate)
                        })
                    }
                )

                context(
                    'when neither name nor subcategories are retrieved',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catsToUpdate = org1Categories
                            const input = Array.from(catsToUpdate, (c, i) =>
                                buildSingleUpdateCategoryInput(c.id)
                            )

                            const expectedErrors = Array.from(
                                input,
                                (_, index) => {
                                    return createInputRequiresAtLeastOne(
                                        index,
                                        'Category',
                                        ['name', 'subcategories']
                                    )
                                }
                            )

                            const operation = updateCategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIErrorCollection(
                                operation,
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoChangesMade(catsToUpdate)
                        })
                    }
                )
            })
        })
    })

    context('DeleteCategories', () => {
        const deleteCategoriesFromResolver = async (
            user: User,
            input: DeleteCategoryInput[]
        ): Promise<CategoriesMutationResult> => {
            const permissions = new UserPermissions(userToPayload(user))
            return mutate(DeleteCategories, { input }, permissions)
        }

        const expectCategoriesDeleted = async (
            user: User,
            catsToDelete: Category[]
        ) => {
            const input = buildDeleteCategoryInputArray(catsToDelete)
            const { categories } = await deleteCategoriesFromResolver(
                user,
                input
            )

            expect(categories).to.have.lengthOf(input.length)
            categories.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.status).to.eq(Status.INACTIVE)
            })

            const categoriesDB = await Category.findByIds(
                input.map((i) => i.id)
            )

            expect(categoriesDB).to.have.lengthOf(input.length)
            categoriesDB.forEach((cdb) => {
                const inputRelated = input.find((i) => i.id === cdb.id)
                expect(inputRelated).to.exist
                expect(cdb.id).to.eq(inputRelated?.id)
                expect(cdb.status).to.eq(Status.INACTIVE)
            })
        }

        beforeEach(async () => {
            await createInitialCategories()
        })

        context('when user is admin', () => {
            it('should delete any category', async () => {
                const catsToDelete = [
                    systemCategories[0],
                    org1Categories[0],
                    org2Categories[0],
                ]

                await expectCategoriesDeleted(admin, catsToDelete)
                await expectCategories(
                    categoriesTotalCount - catsToDelete.length
                )
            })
        })

        context('when user is not admin', () => {
            let user: User
            const permError = permErrorMeta(
                PermissionName.delete_subjects_20447
            )

            context('and has permission', () => {
                it('should delete categories in its organization', async () => {
                    const catsToDelete = org1Categories
                    await expectCategoriesDeleted(
                        userWithPermission,
                        catsToDelete
                    )

                    await expectCategories(
                        categoriesTotalCount - catsToDelete.length
                    )
                })
            })

            context('and has wrong permissions', () => {
                beforeEach(() => {
                    user = userWithPermission
                })

                context('and tries to update system categories', () => {
                    it('throws a permission error', async () => {
                        const catsToDelete = systemCategories
                        const input = buildDeleteCategoryInputArray(
                            catsToDelete
                        )

                        const operation = deleteCategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user)
                        )

                        await expectCategories(categoriesTotalCount)
                    })
                })

                context(
                    'and tries to update categories in an organization which does not belong',
                    () => {
                        it('throws a permission error', async () => {
                            const catsToDelete = org2Categories
                            const input = buildDeleteCategoryInputArray(
                                catsToDelete
                            )

                            const operation = deleteCategoriesFromResolver(
                                user,
                                input
                            )

                            await expect(operation).to.be.rejectedWith(
                                permError(user, [org2])
                            )

                            await expectCategories(categoriesTotalCount)
                        })
                    }
                )
            })

            context('and does not have permissions', () => {
                context('and has membership', () => {
                    beforeEach(() => {
                        user = userWithoutPermission
                    })

                    context(
                        'and tries to delete categories in its organization',
                        () => {
                            it('throws a permission error', async () => {
                                const catsToDelete = org1Categories
                                const input = buildDeleteCategoryInputArray(
                                    catsToDelete
                                )

                                const operation = deleteCategoriesFromResolver(
                                    user,
                                    input
                                )

                                await expect(operation).to.be.rejectedWith(
                                    permError(user, [org1])
                                )

                                await expectCategories(categoriesTotalCount)
                            })
                        }
                    )
                })

                context('and does not have membership', () => {
                    beforeEach(() => {
                        user = userWithoutMembership
                    })

                    context('and tries to delete any categories', () => {
                        it('throws a permission error', async () => {
                            const catsToDelete = [
                                systemCategories[0],
                                org1Categories[0],
                                org2Categories[0],
                            ]

                            const input = buildDeleteCategoryInputArray(
                                catsToDelete
                            )

                            const operation = deleteCategoriesFromResolver(
                                user,
                                input
                            )

                            await expect(operation).to.be.rejectedWith(
                                permError(user)
                            )

                            await expectCategories(categoriesTotalCount)
                        })
                    })
                })
            })
        })
    })

    describe('addSubcategoriesToCategories', () => {
        let editSubjectsRole: Role
        let categoriesOrg1: Category[]
        let categoriesOrg2: Category[]
        let subcategoriesOrg1: Subcategory[]
        let subcategoriesOrg2: Subcategory[]
        let systemSubcategories: Subcategory[]
        const orgsPerType = 5
        let apiErrors: APIError[]
        let expectedError: APIErrorCollection
        let inputs: AddSubcategoriesToCategoryInput[]

        beforeEach(async () => {
            inputs = []
            categoriesOrg1 = []
            categoriesOrg2 = []
            systemCategories = []
            subcategoriesOrg1 = []
            subcategoriesOrg2 = []
            systemSubcategories = []
            admin = await createAdminUser().save()
            userWithPermission = await createUser().save()
            userWithoutPermission = await createUser().save()
            userWithoutMembership = await createUser().save()

            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            for (let x = 0; x < orgsPerType; x++) {
                categoriesOrg1.push(createCategory(org1))
                categoriesOrg2.push(createCategory(org2))
                const systemCategory = createCategory()
                systemCategory.system = true
                systemCategories.push(systemCategory)
                subcategoriesOrg1.push(createSubcategory(org1))
                subcategoriesOrg2.push(createSubcategory(org2))
                const systemSubcategory = createSubcategory()
                systemSubcategory.system = true
                systemSubcategories.push(systemSubcategory)
            }
            await connection.manager.save([
                ...subcategoriesOrg1,
                ...subcategoriesOrg2,
                ...systemSubcategories,
            ])
            for (let x = 0; x < orgsPerType; x++) {
                categoriesOrg1[x].subcategories = Promise.resolve([
                    subcategoriesOrg1[x],
                ])
                categoriesOrg2[x].subcategories = Promise.resolve([
                    subcategoriesOrg2[x],
                ])
                systemCategories[x].subcategories = Promise.resolve([
                    systemSubcategories[x],
                ])
            }
            await connection.manager.save([
                ...categoriesOrg1,
                ...categoriesOrg2,
                ...systemCategories,
            ])

            editSubjectsRole = await createRole('Edit Subjects', org1, {
                permissions: [PermissionName.edit_subjects_20337],
            }).save()

            await createOrganizationMembership({
                user: userWithPermission,
                organization: org1,
                roles: [editSubjectsRole],
            }).save()

            await createOrganizationMembership({
                user: userWithoutPermission,
                organization: org1,
            }).save()
        })

        const addSubcategoriesToCategoriesResolver = async (
            user: User,
            input: AddSubcategoriesToCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
            const result = await addSubcategoriesToCategories(
                { input },
                ctx as Context
            )

            return result
        }

        context('invalid input', () => {
            it('is rejected when input length is more than 50', async () => {
                for (let index = 0; index < 51; index++) {
                    inputs.push({
                        categoryId: 'id-' + index,
                        subcategoryIds: ['x'],
                    })
                }
                const xError = createInputLengthAPIError('Category', 'max')
                await expectAPIError(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    xError
                )
            })
        })

        context('inexistent entity/ies', () => {
            let fakeId: string
            let fakeId2: string
            beforeEach(() => {
                fakeId = faker.datatype.uuid()
                fakeId2 = faker.datatype.uuid()
            })
            it('is rejected when input categoryids does not exist', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.nonexistent_entity.code,
                        message: customErrors.nonexistent_entity.message,
                        variables: ['id'],
                        entity: '',
                        entityName: fakeId,
                        attribute: 'ID',
                        otherAttribute: fakeId,
                        index: 0,
                    }),
                    new APIError({
                        code: customErrors.nonexistent_entity.code,
                        message: customErrors.nonexistent_entity.message,
                        variables: ['id'],
                        entity: '',
                        entityName: fakeId2,
                        attribute: 'ID',
                        otherAttribute: fakeId2,
                        index: 1,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: fakeId,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                    {
                        categoryId: fakeId2,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]

                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
            it('is rejected when one input categoryids does not exist', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.nonexistent_entity.code,
                        message: customErrors.nonexistent_entity.message,
                        variables: ['id'],
                        entity: '',
                        entityName: fakeId,
                        attribute: 'ID',
                        otherAttribute: fakeId,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: fakeId,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
            it('is rejected when input subcategoryids does not exist', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.nonexistent_entity.code,
                        message: customErrors.nonexistent_entity.message,
                        variables: ['id'],
                        entity: '',
                        entityName: fakeId,
                        attribute: 'ID',
                        otherAttribute: fakeId,
                        index: 0,
                    }),
                    new APIError({
                        code: customErrors.nonexistent_entity.code,
                        message: customErrors.nonexistent_entity.message,
                        variables: ['id'],
                        entity: '',
                        entityName: fakeId2,
                        attribute: 'ID',
                        otherAttribute: fakeId2,
                        index: 1,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [fakeId],
                    },
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [fakeId2],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
            it('is rejected when one input subcategoryids does not exist', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.nonexistent_entity.code,
                        message: customErrors.nonexistent_entity.message,
                        variables: ['id'],
                        entity: '',
                        entityName: fakeId,
                        attribute: 'ID',
                        otherAttribute: fakeId,
                        index: 1,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)
                inputs = [
                    {
                        categoryId: categoriesOrg2[0].id,
                        subcategoryIds: [subcategoriesOrg2[1].id],
                    },
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [fakeId],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
        })

        context('inactive entity', () => {
            it('is rejected when some subcategory is inactive', async () => {
                subcategoriesOrg1[0].status = Status.INACTIVE
                await subcategoriesOrg1[0].save()

                apiErrors = [
                    new APIError({
                        code: customErrors.inactive_status.code,
                        message: customErrors.inactive_status.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategoriesOrg1[0].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg1[0].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[1].id,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
            it('is rejected when some category is inactive', async () => {
                categoriesOrg1[0].status = Status.INACTIVE
                await categoriesOrg1[0].save()

                apiErrors = [
                    new APIError({
                        code: customErrors.inactive_status.code,
                        message: customErrors.inactive_status.message,
                        variables: ['id'],
                        entity: 'Category',
                        entityName: categoriesOrg1[0].name,
                        attribute: 'ID',
                        otherAttribute: categoriesOrg1[0].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
        })

        context('duplicated subcategory', () => {
            it('is rejected when some subcategory already existed on the category', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.existent_child_entity.code,
                        message: customErrors.existent_child_entity.message,
                        variables: ['categoryId', 'subcategoryId'],
                        entity: 'Category',
                        entityName: categoriesOrg1[0].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg1[0].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
        })

        context('different organizations', () => {
            it('is rejected when some subcategory and category belongs to different orgs', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategoriesOrg2[0].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg2[0].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg2[0].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(admin, inputs),
                    expectedError
                )
            })
        })

        context('not admin', () => {
            it('is rejected when the category belongs to the system', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Category',
                        entityName: systemCategories[0].name,
                        attribute: 'ID',
                        otherAttribute: systemCategories[0].id,
                        index: 0,
                    }),
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategoriesOrg2[0].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg2[0].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: systemCategories[0].id,
                        subcategoryIds: [subcategoriesOrg2[0].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(
                        userWithPermission,
                        inputs
                    ),
                    expectedError
                )
            })
            it('is rejected when the subcategory belongs to the system', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: systemSubcategories[2].name,
                        attribute: 'ID',
                        otherAttribute: systemSubcategories[2].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [systemSubcategories[2].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(
                        userWithPermission,
                        inputs
                    ),
                    expectedError
                )
            })
            it('is rejected when the user has no membership to the org', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Category',
                        entityName: categoriesOrg1[0].name,
                        attribute: 'ID',
                        otherAttribute: categoriesOrg1[0].id,
                        index: 0,
                    }),
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategoriesOrg1[2].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg1[2].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(
                        userWithoutMembership,
                        inputs
                    ),
                    expectedError
                )
            })
            it('is rejected when the user has no permissions', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Category',
                        entityName: categoriesOrg1[0].name,
                        attribute: 'ID',
                        otherAttribute: categoriesOrg1[0].id,
                        index: 0,
                    }),
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategoriesOrg1[2].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg1[2].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(
                        userWithoutPermission,
                        inputs
                    ),
                    expectedError
                )
            })
            it('is rejected when the user does not belong to the org', async () => {
                apiErrors = [
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Category',
                        entityName: categoriesOrg2[0].name,
                        attribute: 'ID',
                        otherAttribute: categoriesOrg2[0].id,
                        index: 0,
                    }),
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategoriesOrg2[2].name,
                        attribute: 'ID',
                        otherAttribute: subcategoriesOrg2[2].id,
                        index: 0,
                    }),
                ]
                expectedError = new APIErrorCollection(apiErrors)

                inputs = [
                    {
                        categoryId: categoriesOrg2[0].id,
                        subcategoryIds: [subcategoriesOrg2[2].id],
                    },
                ]
                await expectAPIErrorCollection(
                    addSubcategoriesToCategoriesResolver(
                        userWithPermission,
                        inputs
                    ),
                    expectedError
                )
            })
            context('user has permissions', () => {
                let result: CategoriesMutationResult
                beforeEach(async () => {
                    result = await addSubcategoriesToCategoriesResolver(
                        userWithPermission,
                        [
                            {
                                categoryId: categoriesOrg1[0].id,
                                subcategoryIds: [subcategoriesOrg1[2].id],
                            },
                            {
                                categoryId: categoriesOrg1[1].id,
                                subcategoryIds: [subcategoriesOrg1[3].id],
                            },
                        ]
                    )
                })
                it('retrieves the expected updated categoryNodes', async () => {
                    expect(result.categories[0].id).to.equal(
                        categoriesOrg1[0].id
                    )
                    expect(result.categories[0].id).to.eq(categoriesOrg1[0].id)
                    expect(result.categories[0].name).to.eq(
                        categoriesOrg1[0].name
                    )
                    expect(result.categories[0].status).to.eq(
                        categoriesOrg1[0].status
                    )
                    expect(result.categories[0].system).to.eq(
                        categoriesOrg1[0].system
                    )
                })
                it('added the subcategory to the category', async () => {
                    const updatedResult = await Category.findByIds([
                        categoriesOrg1[0].id,
                    ])
                    const subcategories = await updatedResult[0].subcategories
                    expect(subcategories).to.have.lengthOf(2)
                    expect(subcategories?.map((s) => s.id)).to.include(
                        subcategoriesOrg1[2].id
                    )
                })
            })
        })

        context('admin', () => {
            let result: CategoriesMutationResult

            context(
                'adding a subcategory to a category from an organization',
                () => {
                    beforeEach(async () => {
                        result = await addSubcategoriesToCategoriesResolver(
                            admin,
                            [
                                {
                                    categoryId: categoriesOrg1[0].id,
                                    subcategoryIds: [subcategoriesOrg1[2].id],
                                },
                            ]
                        )
                    })
                    it('retrieves the expected updated categoryNodes', async () => {
                        expect(result.categories[0].id).to.equal(
                            categoriesOrg1[0].id
                        )
                        expect(result.categories[0].id).to.eq(
                            categoriesOrg1[0].id
                        )
                        expect(result.categories[0].name).to.eq(
                            categoriesOrg1[0].name
                        )
                        expect(result.categories[0].status).to.eq(
                            categoriesOrg1[0].status
                        )
                        expect(result.categories[0].system).to.eq(
                            categoriesOrg1[0].system
                        )
                    })
                    it('added the subcategory to the category', async () => {
                        const updatedResult = await Category.findByIds([
                            categoriesOrg1[0].id,
                        ])
                        const subcategories = await updatedResult[0]
                            .subcategories
                        expect(subcategories).to.have.lengthOf(2)
                        expect(subcategories?.map((s) => s.id)).to.include(
                            subcategoriesOrg1[2].id
                        )
                    })
                }
            )

            context('adding a subcategory to a category of the system', () => {
                beforeEach(async () => {
                    result = await addSubcategoriesToCategoriesResolver(admin, [
                        {
                            categoryId: systemCategories[0].id,
                            subcategoryIds: [systemSubcategories[2].id],
                        },
                    ])
                })
                it('retrieves the expected updated categoryNodes', async () => {
                    expect(result.categories[0].id).to.equal(
                        systemCategories[0].id
                    )
                    expect(result.categories[0].id).to.eq(
                        systemCategories[0].id
                    )
                    expect(result.categories[0].name).to.eq(
                        systemCategories[0].name
                    )
                    expect(result.categories[0].status).to.eq(
                        systemCategories[0].status
                    )
                    expect(result.categories[0].system).to.eq(
                        systemCategories[0].system
                    )
                })
                it('added the subcategory to the category', async () => {
                    const updatedResult = await Category.findByIds([
                        systemCategories[0].id,
                    ])
                    const subcategories = await updatedResult[0].subcategories
                    expect(subcategories).to.have.lengthOf(2)
                    expect(subcategories?.map((s) => s.id)).to.include(
                        systemSubcategories[2].id
                    )
                })
            })
        })
    })

    context('removeSubcategoriesFromCategories', () => {
        let subcategoriesToRemove: Subcategory[]

        const removeSubcategoriesFromResolver = async (
            user: User,
            input: RemoveSubcategoriesFromCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
            const result = await removeSubcategoriesFromCategories(
                { input },
                ctx
            )

            return result
        }

        const expectRemoveSubcategories = async (
            user: User,
            input: RemoveSubcategoriesFromCategoryInput[]
        ) => {
            const subcategoriesKeeped = new Map()

            for (const i of input) {
                const category = await Category.findOne(i.categoryId)
                const subcategories = (await category?.subcategories) as Subcategory[]

                for (const id of i.subcategoryIds) {
                    const index = subcategories.findIndex((s) => s.id === id)
                    subcategories.splice(index, 1)
                }

                subcategoriesKeeped.set(i.categoryId, subcategories)
            }

            const { categories } = await removeSubcategoriesFromResolver(
                user,
                input
            )

            const categoriesDB = await Category.findByIds(
                input.map((i) => i.categoryId)
            )

            expect(categories).to.have.lengthOf(input.length)
            expect(categoriesDB).to.have.lengthOf(input.length)
            for (const [i, cdb] of categoriesDB.entries()) {
                expect(categories[i].id).to.eq(input[i].categoryId)

                const categoryRelated = categories.find((c) => c.id === cdb.id)
                expect(categoryRelated).to.exist
                expect(cdb.id).to.eq(categoryRelated?.id)
                expect(cdb.name).to.eq(categoryRelated?.name)
                expect(cdb.status).to.eq(categoryRelated?.status)
                expect(cdb.system).to.eq(categoryRelated?.system)

                const subcategories = await cdb?.subcategories
                const subcategoriesRelated = subcategoriesKeeped.get(cdb.id)
                expect(subcategories).to.have.lengthOf(
                    subcategoriesRelated.length
                )

                expect(subcategories).to.deep.equalInAnyOrder(
                    subcategoriesRelated
                )
            }
        }

        const buildDefaultInput = (categories: Category[]) => {
            return buildRemoveSubcategoriesFromCategoryInputArray(
                categories.map((c) => c.id),
                subcategoriesToRemove.map((s) => s.id)
            )
        }

        const expectNoRemoves = async (categories: Category[]) => {
            const categoriesDB = await Category.findByIds(
                categories.map((c) => c.id)
            )

            expect(categoriesDB).to.have.lengthOf(categories.length)
            for (const cdb of categoriesDB) {
                const category = categories.find((c) => c.id === cdb.id)
                const subcategoriesDB = (await cdb.subcategories) as Subcategory[]
                const subcategories = (await category?.subcategories) as Subcategory[]

                expect(subcategoriesDB).to.have.lengthOf(subcategoriesDB.length)
                expect(subcategoriesDB).to.deep.equalInAnyOrder(subcategories)
            }
        }

        beforeEach(async () => {
            await createInitialCategories()
            subcategoriesToRemove = subcategoriesToAdd.slice(0, 2)
        })

        context('permissions', () => {
            context('successful cases', () => {
                context('when user is admin', () => {
                    it('should remove subcategories from any category', async () => {
                        const systemCat = systemCategories[0]
                        const systemCatSubcats = (await systemCat.subcategories) as Subcategory[]

                        await expectRemoveSubcategories(admin, [
                            buildSingleRemoveSubcategoriesFromCategoryInput(
                                systemCat.id,
                                systemCatSubcats.slice(0, 1).map((s) => s.id)
                            ),
                            buildSingleRemoveSubcategoriesFromCategoryInput(
                                org1Categories[0].id,
                                subcategoriesToRemove.map((s) => s.id)
                            ),
                            buildSingleRemoveSubcategoriesFromCategoryInput(
                                org2Categories[0].id,
                                subcategoriesToRemove.map((s) => s.id)
                            ),
                        ])
                    })
                })

                context('when user is not admin', () => {
                    context('but has permission', () => {
                        it('should remove subcategories from categories that belongs to its organization', async () => {
                            await expectRemoveSubcategories(
                                userWithPermission,
                                buildDefaultInput(org1Categories)
                            )
                        })
                    })
                })
            })

            context('error handling', () => {
                let user: User
                const permError = permErrorMeta(
                    PermissionName.edit_subjects_20337
                )

                context('when user is not admin', () => {
                    context('but has permission', () => {
                        beforeEach(() => {
                            user = userWithPermission
                        })

                        context(
                            'and tries to remove subcategories from system categories',
                            () => {
                                it('should throw a permission error', async () => {
                                    const catsToEdit = systemCategories
                                    const input = buildDefaultInput(catsToEdit)
                                    const operation = removeSubcategoriesFromResolver(
                                        user,
                                        input
                                    )

                                    await expect(operation).to.be.rejectedWith(
                                        permError(user)
                                    )

                                    await expectNoRemoves(catsToEdit)
                                })
                            }
                        )

                        context(
                            'and tries to remove subcategories from categories that does not belong to its organization',
                            () => {
                                it('should throw a permission error', async () => {
                                    const catsToEdit = org2Categories
                                    const input = buildDefaultInput(catsToEdit)
                                    const operation = removeSubcategoriesFromResolver(
                                        user,
                                        input
                                    )

                                    await expect(operation).to.be.rejectedWith(
                                        permError(user, [org2])
                                    )

                                    await expectNoRemoves(catsToEdit)
                                })
                            }
                        )
                    })

                    context('and has not permission', () => {
                        context('but has membership', () => {
                            beforeEach(() => {
                                user = userWithoutPermission
                            })

                            context(
                                'and tries to remove subcategories from categories in its organization',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const catsToEdit = org1Categories
                                        const operation = removeSubcategoriesFromResolver(
                                            user,
                                            buildDefaultInput(catsToEdit)
                                        )

                                        await expect(
                                            operation
                                        ).to.be.rejectedWith(
                                            permError(user, [org1])
                                        )

                                        await expectNoRemoves(catsToEdit)
                                    })
                                }
                            )
                        })

                        context('neither has membership', () => {
                            beforeEach(() => {
                                user = userWithoutMembership
                            })

                            context(
                                'and tries to remove subcategories from any category',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const catsToEdit = [
                                            systemCategories[0],
                                            org1Categories[0],
                                            org2Categories[0],
                                        ]

                                        const systemCat = systemCategories[0]
                                        const systemCatSubcats = (await systemCat.subcategories) as Subcategory[]

                                        const input = Array.from(
                                            catsToEdit,
                                            (c, i) =>
                                                buildSingleRemoveSubcategoriesFromCategoryInput(
                                                    c.id,
                                                    i
                                                        ? subcategoriesToRemove.map(
                                                              (s) => s.id
                                                          )
                                                        : systemCatSubcats
                                                              .slice(0, 1)
                                                              .map((s) => s.id)
                                                )
                                        )

                                        const operation = removeSubcategoriesFromResolver(
                                            user,
                                            input
                                        )

                                        await expect(
                                            operation
                                        ).to.be.rejectedWith(
                                            permError(user, [org1, org2])
                                        )

                                        await expectNoRemoves(catsToEdit)
                                    })
                                }
                            )
                        })
                    })
                })
            })
        })

        context('inputs', () => {
            context('error handling', () => {
                context('when input provided is an empty array', () => {
                    it('should throw an APIError', async () => {
                        const expectedError = createInputLengthAPIError(
                            'Category',
                            'min'
                        )

                        const operation = removeSubcategoriesFromResolver(
                            admin,
                            []
                        )

                        await expectAPIError(operation, expectedError)
                    })
                })

                context(
                    `when input length is greater than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE}`,
                    () => {
                        it('should throw an APIError', async () => {
                            const catToEdit = org1Categories[0]
                            const cats = Array.from(
                                new Array(
                                    config.limits
                                        .MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                                ),
                                () => catToEdit
                            )

                            const input = buildDefaultInput(cats)
                            const expectedError = createInputLengthAPIError(
                                'Category',
                                'max'
                            )

                            const operation = removeSubcategoriesFromResolver(
                                admin,
                                input
                            )

                            await expectAPIError(operation, expectedError)
                            await expectNoRemoves([catToEdit])
                        })
                    }
                )

                context(
                    "when input provided has duplicates in 'id' field",
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catToEdit = org1Categories[0]
                            const catsToEdit = Array.from(
                                new Array(3),
                                () => catToEdit
                            )

                            const input = buildDefaultInput(catsToEdit)

                            const expectedErrors = Array.from(
                                [input[1], input[2]],
                                (_, index) => {
                                    return createDuplicateAttributeAPIError(
                                        index + 1,
                                        ['categoryId'],
                                        'RemoveSubcategoriesFromCategoryInput'
                                    )
                                }
                            )

                            await expectAPIErrorCollection(
                                removeSubcategoriesFromResolver(admin, input),
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoRemoves([catToEdit])
                        })
                    }
                )

                context(
                    'when a category with the received id does not exists',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catsToEdit = org1Categories
                            const nonExistentCategoryId = NIL_UUID
                            const input = buildDefaultInput(catsToEdit)

                            input.push({
                                categoryId: nonExistentCategoryId,
                                subcategoryIds: subcategoriesToRemove.map(
                                    (s) => s.id
                                ),
                            })

                            const expectedErrors = [
                                createEntityAPIError(
                                    'nonExistent',
                                    input.length - 1,
                                    'Category',
                                    nonExistentCategoryId
                                ),
                            ]

                            await expectAPIErrorCollection(
                                removeSubcategoriesFromResolver(admin, input),
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoRemoves(catsToEdit)
                        })
                    }
                )

                context('when the received category is inactive', () => {
                    let inactiveCategory: Category

                    beforeEach(async () => {
                        inactiveCategory = org1Categories[0]
                        inactiveCategory.status = Status.INACTIVE
                        await inactiveCategory.save()
                    })

                    it('should throw an ErrorCollection', async () => {
                        const catsToEdit = [inactiveCategory]
                        const input = buildDefaultInput(catsToEdit)
                        const expectedErrors = [
                            createEntityAPIError(
                                'inactive',
                                0,
                                'Category',
                                inactiveCategory.id
                            ),
                        ]

                        await expectAPIErrorCollection(
                            removeSubcategoriesFromResolver(admin, input),
                            new APIErrorCollection(expectedErrors)
                        )

                        await expectNoRemoves(catsToEdit)
                    })
                })

                context(
                    "when input 'subcategoryIds' has duplicate elements",
                    () => {
                        it('should throw an ErrorColection', async () => {
                            const catsToEdit = org1Categories
                            const input = buildRemoveSubcategoriesFromCategoryInputArray(
                                catsToEdit.map((c) => c.id),
                                Array.from(
                                    new Array(2),
                                    () => subcategoriesToRemove[0].id
                                )
                            )

                            const expectedErrors = Array.from(
                                input,
                                (_, index) =>
                                    createDuplicateAttributeAPIError(
                                        index,
                                        ['subcategoryIds'],
                                        'RemoveSubcategoriesFromCategoryInput.subcategoryIds'
                                    )
                            )

                            await expectAPIErrorCollection(
                                removeSubcategoriesFromResolver(admin, input),
                                new APIErrorCollection(expectedErrors)
                            )

                            await expectNoRemoves(catsToEdit)
                        })
                    }
                )

                context('when subcategory received does not exists', () => {
                    it('should throw an ErrorCollection', async () => {
                        const catsToEdit = org1Categories
                        const nonExistentSubcategoryId = NIL_UUID
                        const input = buildRemoveSubcategoriesFromCategoryInputArray(
                            catsToEdit.map((c) => c.id),
                            [
                                ...subcategoriesToRemove.map((s) => s.id),
                                nonExistentSubcategoryId,
                            ]
                        )

                        const expectedErrors = Array.from(input, (_, index) =>
                            createEntityAPIError(
                                'nonExistent',
                                index,
                                'Subcategory',
                                nonExistentSubcategoryId
                            )
                        )

                        await expectAPIErrorCollection(
                            removeSubcategoriesFromResolver(admin, input),
                            new APIErrorCollection(expectedErrors)
                        )

                        await expectNoRemoves(catsToEdit)
                    })
                })

                context('when subcategory received is inactive', () => {
                    let inactiveSubcategory: Subcategory

                    beforeEach(async () => {
                        inactiveSubcategory = subcategoriesToRemove[0]
                        inactiveSubcategory.status = Status.INACTIVE
                        await inactiveSubcategory.save()
                    })

                    it('should throw an ErrorCollection', async () => {
                        const catsToEdit = org1Categories
                        const input = buildDefaultInput(catsToEdit)
                        const expectedErrors = Array.from(input, (_, index) =>
                            createEntityAPIError(
                                'inactive',
                                index,
                                'Subcategory',
                                inactiveSubcategory.id
                            )
                        )

                        await expectAPIErrorCollection(
                            removeSubcategoriesFromResolver(admin, input),
                            new APIErrorCollection(expectedErrors)
                        )

                        await expectNoRemoves(catsToEdit)
                    })
                })

                context('when subcategory does not exists in category', () => {
                    it('should throw an ErrorCollection', async () => {
                        const catsToEdit = org1Categories
                        const notLinkedSubcategory = await Subcategory.findOneOrFail(
                            {
                                where: {
                                    id: Not(
                                        In(subcategoriesToAdd.map((s) => s.id))
                                    ),
                                },
                            }
                        )

                        const input = buildRemoveSubcategoriesFromCategoryInputArray(
                            catsToEdit.map((c) => c.id),
                            [
                                ...subcategoriesToRemove.map((s) => s.id),
                                notLinkedSubcategory.id,
                            ]
                        )

                        const expectedErrors = Array.from(input, (i, index) =>
                            createEntityAPIError(
                                'nonExistentChild',
                                index,
                                'Subcategory',
                                notLinkedSubcategory.id,
                                'Category',
                                i.categoryId,
                                ['categoryId', 'subcategoryIds']
                            )
                        )

                        await expectAPIErrorCollection(
                            removeSubcategoriesFromResolver(admin, input),
                            new APIErrorCollection(expectedErrors)
                        )

                        await expectNoRemoves(catsToEdit)
                    })
                })
            })
        })

        context('DB calls', () => {
            context(
                'when the categories belong to the same organization',
                () => {
                    it('should do 9 DB calls', async () => {
                        const categories = org1Categories

                        connection.logger.reset()
                        await removeSubcategoriesFromResolver(
                            admin,
                            buildDefaultInput(categories)
                        )

                        const callsToDB = connection.logger.count
                        expect(callsToDB).to.eq(
                            9,
                            '3 for get categories, subcategories and existentSubcategories; 1 for check permissions; and 5 for save changes'
                        )
                    })
                }
            )

            context(
                'when the categories belong to different organizations',
                () => {
                    it('should do 9 DB calls', async () => {
                        const categories = [
                            ...org1Categories.slice(0, 3),
                            ...org2Categories.slice(0, 3),
                        ]

                        connection.logger.reset()
                        await removeSubcategoriesFromResolver(
                            admin,
                            buildDefaultInput(categories)
                        )

                        const callsToDB = connection.logger.count
                        expect(callsToDB).to.eq(
                            9,
                            '3 for get categories, subcategories and existentSubcategories; 1 for check permissions; and 5 for save changes'
                        )
                    })
                }
            )

            context('when the categories are system', () => {
                it('should do 10 DB calls', async () => {
                    const systemCat = systemCategories[0]
                    const systemCatSubcats = (await systemCat.subcategories) as Subcategory[]

                    connection.logger.reset()
                    await removeSubcategoriesFromResolver(admin, [
                        buildSingleRemoveSubcategoriesFromCategoryInput(
                            systemCat.id,
                            systemCatSubcats.slice(0, 1).map((s) => s.id)
                        ),
                    ])

                    const callsToDB = connection.logger.count
                    expect(callsToDB).to.eq(
                        10,
                        '3 for get categories, subcategories and existentSubcategories; 1 for check permissions; and 6 for save changes'
                    )
                })
            })
        })
    })
}))