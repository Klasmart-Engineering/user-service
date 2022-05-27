import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { getConnection, In, Not } from 'typeorm'
import { Category } from '../../src/entities/category'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { Status } from '../../src/entities/status'
import { Subcategory } from '../../src/entities/subcategory'
import { User } from '../../src/entities/user'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { categoryConnectionNodeFields } from '../../src/pagination/categoriesConnection'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    AddSubcategoriesToCategories,
    CreateCategories,
    DeleteCategories,
    RemoveSubcategoriesFromCategories,
    UpdateCategories,
} from '../../src/resolvers/category'
import { APIError } from '../../src/types/errors/apiError'
import {
    AddSubcategoriesToCategoryInput,
    CategoriesMutationResult,
    CategoryConnectionNode,
    CreateCategoryInput,
    DeleteCategoryInput,
    RemoveSubcategoriesFromCategoryInput,
    UpdateCategoryInput,
} from '../../src/types/graphQL/category'
import { createCategories, createCategory } from '../factories/category.factory'
import {
    createDuplicateAttributeAPIError,
    createDuplicateInputAttributeAPIError,
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
    createInputLengthAPIError,
    createInputRequiresAtLeastOne,
} from '../../src/utils/resolvers/errors'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createAdminUser, createUser } from '../factories/user.factory'
import { NIL_UUID } from '../utils/database'
import {
    buildRemoveSubcategoriesFromCategoryInputArray,
    buildSingleRemoveSubcategoriesFromCategoryInput,
    buildSingleUpdateCategoryInput,
    buildUpdateCategoryInputArray,
} from '../utils/operations/categoryOps'
import { userToPayload } from '../utils/operations/userOps'
import { config } from '../../src/config/config'
import {
    createSubcategories,
    createSubcategory,
} from '../factories/subcategory.factory'
import faker from 'faker'
import CategoriesInitializer from '../../src/initializers/categories'
import { buildDeleteCategoryInputArray } from '../utils/operations/categoryOps'
import { compareErrors, compareMultipleErrors } from '../utils/apiError'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { permErrorMeta } from '../utils/errors'
import { TestConnection } from '../utils/testConnection'
import { permutations } from '../utils/permute'
import { v4 as uuidv4 } from 'uuid'

interface CategoryAndSubcategories {
    id: string
    name?: string
    __subcategories__?: { id: string }[]
}

type NoUpdateProp = 'name' | 'subcategoryIds' | 'both'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('category', () => {
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
    let connection: TestConnection

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

    const generateExistingCategories = async (org: Organization) => {
        const existingCategory = await createCategory(org).save()
        const nonPermittedOrgCategory = await createCategory(
            await createOrganization().save()
        ).save()

        const inactiveCategory = createCategory(org)
        inactiveCategory.status = Status.INACTIVE
        await inactiveCategory.save()

        const inactiveOrg = createOrganization()
        inactiveOrg.status = Status.INACTIVE
        await inactiveOrg.save()
        const inactiveOrgCategory = await createCategory(inactiveOrg).save()

        return [
            existingCategory,
            nonPermittedOrgCategory,
            inactiveCategory,
            inactiveOrgCategory,
        ]
    }

    before(() => (connection = getConnection() as TestConnection))

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

    context('CreateCategories', () => {
        let createCategories: CreateCategories
        let permissions: UserPermissions

        const createCategoriesFromResolver = async (
            user: User,
            input: CreateCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const result: CategoriesMutationResult = await mutate(
                CreateCategories,
                { input },
                permissions
            )

            return result
        }

        const buildCreateCategoryInput = (
            name: string,
            org: Organization,
            subcats?: Subcategory[]
        ): CreateCategoryInput => {
            return {
                name,
                organizationId: org.organization_id,
                subcategoryIds: subcats?.map((s) => s.id),
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
                    subcategoryIds: (c as any).__subcategories__.map(
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
                expect(cdb.subcategoryIds).to.deep.equalInAnyOrder(
                    input[i].subcategoryIds
                )
            })
        }

        beforeEach(async () => {
            permissions = new UserPermissions(userToPayload(admin))
            createCategories = new CreateCategories([], permissions)
        })

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

        context('when subcategoryIds are not provided', () => {
            it('should create categories without subcategories', async () => {
                const input = generateInput(2, org1, false)
                await expectCategoriesCreated(admin, input)
            })
        })

        context('DB calls', () => {
            const getDbCallCount = async (input: CreateCategoryInput[]) => {
                connection.logger.reset()
                await mutate(CreateCategories, { input }, permissions)
                return connection.logger.count
            }

            const resetCategories = async () => {
                const createdCats = await Category.find({
                    where: { status: Status.ACTIVE },
                })

                await Promise.all(
                    createdCats.map((c) => c.inactivate(connection.manager))
                )

                await Category.save(createdCats)
            }

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount(generateInput(1, org1, true)) // warm up permissions cache
                await resetCategories()

                const singleCategoryCount = await getDbCallCount(
                    generateInput(1, org1, true)
                )
                await resetCategories()

                const fiveCategoriesCount = await getDbCallCount(
                    generateInput(5, org1, true)
                )
                await resetCategories()

                expect(fiveCategoriesCount).to.be.eq(singleCategoryCount)
                expect(fiveCategoriesCount).to.be.equal(5)
            })
        })

        context('generateEntityMaps', () => {
            it('returns existing categories', async () => {
                const existingCategories = await generateExistingCategories(
                    org1
                )

                const expectedPairs = await Promise.all(
                    existingCategories
                        .filter((ec) => ec.status === Status.ACTIVE)
                        .map(async (ec) => {
                            return {
                                organizationId: (await ec.organization)!
                                    .organization_id,
                                name: ec.name!,
                            }
                        })
                )

                const input: CreateCategoryInput[] = [
                    ...expectedPairs.map((ep) => {
                        return {
                            organizationId: ep.organizationId,
                            name: ep.name,
                            subcategoryIds: subcategoriesToAdd.map((s) => s.id),
                        }
                    }),
                    ...generateInput(1, org1, true),
                ]

                const entityMaps = await createCategories.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
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
                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareErrors(result, expectedError)
                    await expectCategories(0)
                })
            })

            context('when there are too many inputs', () => {
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

                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareErrors(result, expectedError)
                    await expectCategories(0)
                })
            })

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
                                subcategoryIds,
                            }
                        })

                        const result = await expect(
                            createCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        const expectedErrors = Array.from(input, (i, index) =>
                            createEntityAPIError(
                                'nonExistent',
                                index,
                                'Organization',
                                i.organizationId
                            )
                        )

                        compareMultipleErrors(result.errors, expectedErrors)
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
                                subcategoryIds: [NIL_UUID],
                            }
                        })

                        const result = await expect(
                            createCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        const expectedErrors = Array.from(input, (i, index) =>
                            createEntityAPIError(
                                'nonExistent',
                                index,
                                'Subcategory',
                                i.subcategoryIds[0]
                            )
                        )

                        compareMultipleErrors(result.errors, expectedErrors)
                        await expectCategories(0)
                    })
                }
            )

            context(
                'when user tries to create categories adding subcategories that does not exist for the same organization as the given in organizationId',
                () => {
                    let nonBelongingSubcategory: Subcategory

                    beforeEach(async () => {
                        nonBelongingSubcategory = await createSubcategory(
                            org2
                        ).save()
                    })

                    it('throws an ErrorCollection', async () => {
                        const input = generateInput(3, org1, true)
                        input[0].subcategoryIds?.push(
                            nonBelongingSubcategory.id
                        )

                        const expectedErrors = [
                            createEntityAPIError(
                                'nonExistentChild',
                                0,
                                'Subcategory',
                                nonBelongingSubcategory.id,
                                'Organization',
                                org1.organization_id
                            ),
                        ]

                        const result = await expect(
                            createCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)
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

                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)
                    await expectCategories(0)
                })
            })

            context('when subcategoryIds is empty', () => {
                it('throws an ErrorCollection', async () => {
                    const input = generateInput(3, org1, true)
                    input[0].subcategoryIds = []

                    const expectedErrors = [
                        createInputLengthAPIError(
                            'CreateCategoryInput',
                            'min',
                            'subcategoryIds',
                            0
                        ),
                    ]

                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)
                    await expectCategories(0)
                })
            })

            context('when there are too many subcategoryIds', () => {
                it('throws an ErrorCollection', async () => {
                    const input = generateInput(3, org1, true)
                    input[0].subcategoryIds = Array.from(
                        new Array(
                            config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                        ),
                        () => uuidv4()
                    )

                    const expectedErrors = [
                        createInputLengthAPIError(
                            'CreateCategoryInput',
                            'max',
                            'subcategoryIds',
                            0
                        ),
                    ]

                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)
                    await expectCategories(0)
                })
            })

            context('when subcategoryIds has duplicated elements', () => {
                it('throws an ErrorCollection', async () => {
                    const input = generateInput(3, org1, true)
                    const idToRepeat = input[0].subcategoryIds![0]
                    input[0].subcategoryIds = [idToRepeat, idToRepeat]

                    const expectedErrors = [
                        createDuplicateAttributeAPIError(
                            0,
                            ['subcategoryIds'],
                            'CreateCategoryInput'
                        ),
                    ]

                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)
                    await expectCategories(0)
                })
            })

            context('when the category to create already exists', () => {
                let input: CreateCategoryInput[]
                let existentCategory: CategoryConnectionNode

                beforeEach(async () => {
                    input = generateInput(1, org1, true)
                    const categoriesResult = await createCategoriesFromResolver(
                        admin,
                        input
                    )
                    existentCategory = categoriesResult.categories[0]
                })

                it('throws an ErrorCollection', async () => {
                    const expectedErrors = Array.from(input, (i, index) =>
                        createExistentEntityAttributeAPIError(
                            'Category',
                            existentCategory.id,
                            'name',
                            i.name,
                            index
                        )
                    )

                    const result = await expect(
                        createCategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)

                    // The already existent category is the only expected
                    await expectCategories(1)
                })
            })
        })
    })

    context('UpdateCategories', () => {
        let permissions: UserPermissions
        let updateCategories: UpdateCategories
        let subcategoriesForUpdate: Subcategory[]

        const updateCategoriesFromResolver = async (
            user: User,
            input: UpdateCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const result: CategoriesMutationResult = await mutate(
                UpdateCategories,
                { input },
                permissions
            )

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
                    subcategoryIds: (c as CategoryAndSubcategories).__subcategories__?.map(
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
                expect(cdb.subcategoryIds).to.deep.equalInAnyOrder(
                    inputRelated?.subcategoryIds
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
                noUpdate === 'subcategoryIds' || noUpdate === 'both'

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
                expect(cdb.subcategoryIds).to.deep.equalInAnyOrder(
                    avoidSubcategories
                        ? (await categoryRelated?.subcategories)?.map(
                              (s) => s.id
                          )
                        : inputRelated?.subcategoryIds
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
            permissions = new UserPermissions(userToPayload(admin))
            updateCategories = new UpdateCategories([], permissions)

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
                            'subcategoryIds'
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
                        const result = await expect(
                            updateCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareErrors(result, expectedError)
                        // no expecting for no changes because nothing was sent
                    })
                })

                context('when there are too many inputs', () => {
                    it('should throw an APIError', async () => {
                        const categoryToUpdate = org1Categories[0]
                        const catsToUpdate = Array.from(
                            new Array(
                                config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
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

                        const result = await expect(
                            updateCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareErrors(result, expectedError)
                        await expectNoChangesMade([categoryToUpdate])
                    })
                })

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

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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
                                    return createDuplicateInputAttributeAPIError(
                                        index + 1,
                                        'Category',
                                        org1.organization_id,
                                        'name',
                                        input[index + 1].name!
                                    )
                                }
                            )

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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
                        const expectedErrors = [
                            createEntityAPIError(
                                'nonExistent',
                                0,
                                'Category',
                                inactiveCategory.id
                            ),
                        ]

                        const input = buildUpdateCategoryInputArray(
                            catsToUpdate.map((c) => c.id)
                        )

                        const result = await expect(
                            updateCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

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
                                    return createExistentEntityAttributeAPIError(
                                        'Category',
                                        org1Categories[index + 1].id,
                                        'name',
                                        org1Categories[index + 1].name!,
                                        index
                                    )
                                }
                            )

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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
                                (i, index) => {
                                    return createEntityAPIError(
                                        'nonExistent',
                                        index,
                                        'Subcategory',
                                        i.subcategoryIds![0]
                                    )
                                }
                            )

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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
                                        'UpdateCategoryInput',
                                        ['name', 'subcategoryIds']
                                    )
                                }
                            )

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

                            await expectNoChangesMade(catsToUpdate)
                        })
                    }
                )

                context('when subcategoryIds is an empty array', () => {
                    it('should throw an ErrorCollection', async () => {
                        const catsToUpdate = org1Categories
                        const input = buildUpdateCategoryInputArray(
                            catsToUpdate.map((c) => c.id),
                            []
                        )

                        const expectedErrors = Array.from(input, (_, index) =>
                            createInputLengthAPIError(
                                'UpdateCategoryInput',
                                'min',
                                'subcategoryIds',
                                index
                            )
                        )

                        const result = await expect(
                            updateCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoChangesMade(org1Categories)
                    })
                })

                context('when there are too many subcategoryIds', () => {
                    it('should throw an ErrorCollection', async () => {
                        const catsToUpdate = org1Categories
                        const orgSubcats = await Subcategory.save(
                            createSubcategories(
                                config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1,
                                org1
                            )
                        )

                        const input = buildUpdateCategoryInputArray(
                            catsToUpdate.map((c) => c.id),
                            Array.from(orgSubcats, (s) => s.id)
                        )

                        const expectedErrors = Array.from(input, (_, index) =>
                            createInputLengthAPIError(
                                'UpdateCategoryInput',
                                'max',
                                'subcategoryIds',
                                index
                            )
                        )

                        const result = await expect(
                            updateCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoChangesMade(org1Categories)
                    })
                })

                context('when subcategoryIds are duplicated', () => {
                    it('should throw an ErrorCollection', async () => {
                        const catsToUpdate = org1Categories
                        const duplicateSubcat = subcategoriesForUpdate[0].id
                        const input = buildUpdateCategoryInputArray(
                            catsToUpdate.map((c) => c.id),
                            [duplicateSubcat, duplicateSubcat]
                        )

                        const expectedErrors = Array.from(input, (_, index) =>
                            createDuplicateAttributeAPIError(
                                index,
                                ['subcategoryIds'],
                                'UpdateCategoryInput'
                            )
                        )

                        const result = await expect(
                            updateCategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoChangesMade(org1Categories)
                    })
                })

                context(
                    'when subcategories does not belong to the same organization as the category and they are not system',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const catsToUpdate = org1Categories
                            const org2Subcat = await createSubcategory(
                                org2
                            ).save()

                            const input = buildUpdateCategoryInputArray(
                                catsToUpdate.map((c) => c.id),
                                [org2Subcat.id]
                            )

                            const expectedErrors = Array.from(
                                input,
                                (_, index) =>
                                    createEntityAPIError(
                                        'nonExistentChild',
                                        index,
                                        'Subcategory',
                                        org2Subcat.id,
                                        'Organization',
                                        org1.organization_id
                                    )
                            )

                            const result = await expect(
                                updateCategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

                            await expectNoChangesMade(org1Categories)
                        })
                    }
                )
            })
        })

        context('DB calls', () => {
            const getDbCallCount = async (input: UpdateCategoryInput[]) => {
                connection.logger.reset()
                await mutate(UpdateCategories, { input }, permissions)
                return connection.logger.count
            }

            it('db connections do not increase with number of input elements', async () => {
                // warm up permissions cache
                await getDbCallCount(
                    buildUpdateCategoryInputArray(
                        [org1Categories[0].id],
                        subcategoriesForUpdate.map((s) => s.id),
                        true
                    )
                )

                const singleCategoryCount = await getDbCallCount(
                    buildUpdateCategoryInputArray(
                        [org1Categories[1].id],
                        subcategoriesForUpdate.map((s) => s.id),
                        true
                    )
                )

                const twoCategoriesCount = await getDbCallCount(
                    buildUpdateCategoryInputArray(
                        [org1Categories[2].id, org1Categories[3].id],
                        subcategoriesForUpdate.map((s) => s.id),
                        true
                    )
                )

                expect(twoCategoriesCount).to.be.eq(singleCategoryCount)
                expect(twoCategoriesCount).to.be.equal(7)
            })
        })

        context('generateEntityMaps', () => {
            it('returns organization ids', async () => {
                const systemCats = await Category.save(createCategories(5))

                const otherOrg = await createOrganization().save()
                const otherCats = await Category.save(
                    createCategories(5, otherOrg)
                )

                const expectedIds = [
                    org1.organization_id,
                    otherOrg.organization_id,
                ]

                const input = buildUpdateCategoryInputArray(
                    [...org1Categories, ...otherCats, ...systemCats].map(
                        (c) => c.id
                    )
                )

                const entityMaps = await updateCategories.generateEntityMaps(
                    input
                )

                expect(entityMaps.organizationIds).to.deep.equalInAnyOrder(
                    expectedIds
                )
            })

            it('returns existing categories', async () => {
                const existingCategories = await generateExistingCategories(
                    org1
                )
                const expectedPairs = await Promise.all(
                    existingCategories
                        .filter((ec) => ec.status === Status.ACTIVE)
                        .map(async (ec) => {
                            return {
                                id: ec.id,
                                organizationId: (await ec.organization)
                                    ?.organization_id,
                                name: ec.name!,
                            }
                        })
                )

                const input: UpdateCategoryInput[] = [
                    ...expectedPairs.map((ep) => {
                        return {
                            id: ep.id,
                            name: ep.name,
                        }
                    }),
                    {
                        id: org1Categories[0].id,
                        name: faker.random.word(),
                    },
                ]

                const entityMaps = await updateCategories.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(
                    expectedPairs.map((ep) => {
                        return {
                            organizationId: ep.organizationId,
                            name: ep.name,
                        }
                    })
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

    describe('AddSubcategoriesToCategories', () => {
        let editSubjectsRole: Role
        let categoriesOrg1: Category[]
        let categoriesOrg2: Category[]
        let subcategoriesOrg1: Subcategory[]
        let subcategoriesOrg2: Subcategory[]
        let systemSubcategories: Subcategory[]
        const orgsPerType = 5
        let apiErrors: APIError[]
        let inputs: AddSubcategoriesToCategoryInput[]
        let addSubcategoriesToCategories: AddSubcategoriesToCategories

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

            const permissions = new UserPermissions(userToPayload(admin))
            addSubcategoriesToCategories = new AddSubcategoriesToCategories(
                [],
                permissions
            )
        })

        const addSubcategoriesToCategoriesResolver = async (
            user: User,
            input: AddSubcategoriesToCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            return mutate(AddSubcategoriesToCategories, { input }, permissions)
        }

        context('generateEntityMaps', () => {
            it('returns organization ids', async () => {
                const systemCats = await Category.save(createCategories(5))
                const systemSubcats = createSubcategories(3)
                systemSubcats.forEach((s) => {
                    s.system = true
                })

                await Subcategory.save(systemSubcats)

                const org = await createOrganization().save()
                const cats = await Category.save(createCategories(5, org))

                const otherOrg = await createOrganization().save()
                const otherCats = await Category.save(
                    createCategories(5, otherOrg)
                )

                const expectedIds = [
                    org.organization_id,
                    otherOrg.organization_id,
                ]

                const input = Array.from(
                    [...cats, ...otherCats, ...systemCats],
                    (c) => {
                        return {
                            categoryId: c.id,
                            subcategoryIds: systemSubcats.map((s) => s.id),
                        }
                    }
                )

                const entityMaps = await addSubcategoriesToCategories.generateEntityMaps(
                    input
                )

                expect(entityMaps.organizationIds).to.deep.equalInAnyOrder(
                    expectedIds
                )
            })

            it('returns existing categories subcategories relations', async () => {
                const org = await createOrganization().save()
                const subcats = await Subcategory.save(
                    createSubcategories(3, org)
                )

                const cats = await Category.save(
                    createCategories(5, org, [subcats[0]])
                )

                inputs = cats.map((c) => {
                    return {
                        categoryId: c.id,
                        subcategoryIds: subcats.slice(1).map((s) => s.id),
                    }
                })

                const expectedCategoriesSubcategories = new Map(
                    cats.map((c) => [c.id, [subcats[0]]])
                )

                const entityMaps = await addSubcategoriesToCategories.generateEntityMaps(
                    inputs
                )

                expect(
                    entityMaps.categoriesSubcategories.keys()
                ).to.deep.equalInAnyOrder(
                    expectedCategoriesSubcategories.keys()
                )

                expect(
                    entityMaps.categoriesSubcategories.values()
                ).to.deep.equalInAnyOrder(
                    expectedCategoriesSubcategories.values()
                )
            })
        })

        context('DB calls', () => {
            let subcats: Subcategory[]
            let cats: Category[]

            const getDbCallCount = async (
                user: User,
                input: AddSubcategoriesToCategoryInput[]
            ) => {
                connection.logger.reset()
                await addSubcategoriesToCategoriesResolver(user, input)
                return connection.logger.count
            }

            beforeEach(async () => {
                const org = await createOrganization().save()
                subcats = await Subcategory.save(createSubcategories(3, org))

                cats = await Category.save(
                    createCategories(5, org, [subcats[0]])
                )
            })

            it('db connections do not increase with number of input elements', async () => {
                // warm up permissions cache
                await getDbCallCount(admin, [
                    {
                        categoryId: cats[0].id,
                        subcategoryIds: [subcats[1].id],
                    },
                ])

                const singleCategoryCount = await getDbCallCount(admin, [
                    {
                        categoryId: cats[1].id,
                        subcategoryIds: [subcats[1].id],
                    },
                ])

                const twoCategoriesCount = await getDbCallCount(admin, [
                    {
                        categoryId: cats[2].id,
                        subcategoryIds: [subcats[1].id],
                    },
                    {
                        categoryId: cats[3].id,
                        subcategoryIds: [subcats[1].id],
                    },
                ])

                expect(twoCategoriesCount).to.be.eq(singleCategoryCount)
                expect(twoCategoriesCount).to.be.equal(6)
            })
        })

        context('invalid input', () => {
            it('is rejected when input length is more than 50', async () => {
                for (let index = 0; index < 51; index++) {
                    inputs.push({
                        categoryId: 'id-' + index,
                        subcategoryIds: ['x'],
                    })
                }
                const expectedError = createInputLengthAPIError(
                    'Category',
                    'max'
                )

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareErrors(result, expectedError)
            })

            it('is rejected when categoryId is duplicated', async () => {
                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[1].id],
                    },
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]

                apiErrors = [
                    createDuplicateAttributeAPIError(
                        1,
                        ['categoryId'],
                        'AddSubcategoriesToCategoryInput'
                    ),
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })

            it('is rejected when subcategoryIds are duplicated', async () => {
                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [
                            subcategoriesOrg1[1].id,
                            subcategoriesOrg1[1].id,
                        ],
                    },
                ]

                apiErrors = [
                    createDuplicateAttributeAPIError(
                        0,
                        ['subcategoryIds'],
                        'AddSubcategoriesToCategoryInput'
                    ),
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })

            it('is rejected when subcategoryIds is empty', async () => {
                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [],
                    },
                ]

                apiErrors = [
                    createInputLengthAPIError(
                        'AddSubcategoriesToCategoryInput',
                        'min',
                        'subcategoryIds',
                        0
                    ),
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })

            it('when there are too many subcategoryIds', async () => {
                const orgSubcats = await Subcategory.save(
                    createSubcategories(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1,
                        org1
                    )
                )

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: orgSubcats.map((s) => s.id),
                    },
                ]

                apiErrors = [
                    createInputLengthAPIError(
                        'AddSubcategoriesToCategoryInput',
                        'max',
                        'subcategoryIds',
                        0
                    ),
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
        })

        context('inexistent entity/ies', () => {
            let fakeId: string
            let fakeId2: string
            beforeEach(() => {
                fakeId = faker.datatype.uuid()
                fakeId2 = faker.datatype.uuid()
            })

            it('is rejected when input categoryIds does not exist', async () => {
                apiErrors = [
                    createEntityAPIError('nonExistent', 0, 'Category', fakeId),
                    createEntityAPIError('nonExistent', 1, 'Category', fakeId2),
                ]

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

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected
                compareMultipleErrors(result.errors, apiErrors)
            })
            it('is rejected when one input categoryIds does not exist', async () => {
                apiErrors = [
                    createEntityAPIError('nonExistent', 0, 'Category', fakeId),
                ]

                inputs = [
                    {
                        categoryId: fakeId,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
            it('is rejected when input subcategoryIds does not exist', async () => {
                apiErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        0,
                        'Subcategory',
                        fakeId
                    ),
                    createEntityAPIError(
                        'nonExistent',
                        1,
                        'Subcategory',
                        fakeId2
                    ),
                ]

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [fakeId],
                    },
                    {
                        categoryId: categoriesOrg1[1].id,
                        subcategoryIds: [fakeId2],
                    },
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
            it('is rejected when one input subcategoryids does not exist', async () => {
                apiErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        1,
                        'Subcategory',
                        fakeId
                    ),
                ]

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

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
        })

        context('inactive entity', () => {
            it('is rejected when some subcategory is inactive', async () => {
                subcategoriesOrg1[0].status = Status.INACTIVE
                await subcategoriesOrg1[0].save()

                apiErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        0,
                        'Subcategory',
                        subcategoriesOrg1[0].id
                    ),
                ]

                inputs = [
                    {
                        categoryId: categoriesOrg1[1].id,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })

            it('is rejected when some category is inactive', async () => {
                categoriesOrg1[0].status = Status.INACTIVE
                await categoriesOrg1[0].save()

                apiErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        0,
                        'Category',
                        categoriesOrg1[0].id
                    ),
                ]

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
        })

        context('duplicated subcategory', () => {
            it('is rejected when some subcategory already existed on the category', async () => {
                apiErrors = [
                    createEntityAPIError(
                        'existentChild',
                        0,
                        'Subcategory',
                        subcategoriesOrg1[0].id,
                        'Category',
                        categoriesOrg1[0].id
                    ),
                ]

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[0].id],
                    },
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
        })

        context('different organizations', () => {
            it('is rejected when some subcategory and category belongs to different orgs', async () => {
                apiErrors = [
                    createEntityAPIError(
                        'nonExistentChild',
                        0,
                        'Subcategory',
                        subcategoriesOrg2[0].id,
                        'Organization',
                        org1.organization_id
                    ),
                ]

                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg2[0].id],
                    },
                ]

                const result = await expect(
                    addSubcategoriesToCategoriesResolver(admin, inputs)
                ).to.be.rejected

                compareMultipleErrors(result.errors, apiErrors)
            })
        })

        context('not admin', () => {
            const permError = permErrorMeta(PermissionName.edit_subjects_20337)

            it('is rejected when the category belongs to the system', async () => {
                const user = userWithPermission
                inputs = [
                    {
                        categoryId: systemCategories[0].id,
                        subcategoryIds: [subcategoriesOrg2[0].id],
                    },
                ]

                const operation = addSubcategoriesToCategoriesResolver(
                    user,
                    inputs
                )

                await expect(operation).to.be.rejectedWith(permError(user))
            })

            it('is rejected when the user has no membership to the org', async () => {
                const user = userWithoutMembership
                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]

                const operation = addSubcategoriesToCategoriesResolver(
                    user,
                    inputs
                )

                await expect(operation).to.be.rejectedWith(permError(user))
            })

            it('is rejected when the user has no permissions', async () => {
                const user = userWithoutPermission
                inputs = [
                    {
                        categoryId: categoriesOrg1[0].id,
                        subcategoryIds: [subcategoriesOrg1[2].id],
                    },
                ]

                const operation = addSubcategoriesToCategoriesResolver(
                    user,
                    inputs
                )

                await expect(operation).to.be.rejectedWith(permError(user))
            })

            it('is rejected when the user does not belong to the org', async () => {
                const user = userWithPermission
                inputs = [
                    {
                        categoryId: categoriesOrg2[0].id,
                        subcategoryIds: [subcategoriesOrg2[2].id],
                    },
                ]

                const operation = addSubcategoriesToCategoriesResolver(
                    user,
                    inputs
                )

                await expect(operation).to.be.rejectedWith(permError(user))
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

    context('RemoveSubcategoriesFromCategories', () => {
        let subcategoriesToRemove: Subcategory[]

        const removeSubcategoriesFromResolver = async (
            user: User,
            input: RemoveSubcategoriesFromCategoryInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            const result: CategoriesMutationResult = await mutate(
                RemoveSubcategoriesFromCategories,
                { input },
                permissions
            )

            return result
        }

        const expectRemoveSubcategories = async (
            user: User,
            input: RemoveSubcategoriesFromCategoryInput[]
        ) => {
            const subcategoriesKept = new Map()

            for (const i of input) {
                const category = await Category.findOneBy({ id: i.categoryId })
                const subcategories = (await category?.subcategories) as Subcategory[]

                for (const id of i.subcategoryIds) {
                    const index = subcategories.findIndex((s) => s.id === id)
                    subcategories.splice(index, 1)
                }

                subcategoriesKept.set(i.categoryId, subcategories)
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
                const subcategoriesRelated = subcategoriesKept.get(cdb.id)
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

                    context('and does not have permission', () => {
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
                                        const systemCat = systemCategories[0]
                                        const systemCatSubcatId = (await systemCat.subcategories)![0]
                                            .id
                                        const orgSubcatId = subcategoriesToRemove.map(
                                            (s) => s.id
                                        )
                                        const catsToEdit = [
                                            systemCat,
                                            org1Categories[0],
                                            org2Categories[0],
                                        ]

                                        const input = catsToEdit.map((c) =>
                                            buildSingleRemoveSubcategoriesFromCategoryInput(
                                                c.id,
                                                c.id === systemCat.id
                                                    ? [systemCatSubcatId]
                                                    : orgSubcatId
                                            )
                                        )

                                        const operation = removeSubcategoriesFromResolver(
                                            user,
                                            input
                                        )

                                        const err: Error = await expect(
                                            operation
                                        ).to.be.rejected
                                        const possibleErrors = permutations([
                                            org1,
                                            org2,
                                        ]).map((orgs) => permError(user, orgs))
                                        expect(possibleErrors).to.include(
                                            err.message
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

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, [])
                        ).to.be.rejected

                        compareErrors(result, expectedError)
                    })
                })

                context('when there are too many inputs', () => {
                    it('should throw an APIError', async () => {
                        const catToEdit = org1Categories[0]
                        const cats = Array.from(
                            new Array(
                                config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                            ),
                            () => catToEdit
                        )

                        const input = buildDefaultInput(cats)
                        const expectedError = createInputLengthAPIError(
                            'Category',
                            'max'
                        )

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareErrors(result, expectedError)
                        await expectNoRemoves([catToEdit])
                    })
                })

                context(
                    "when input provided has duplicates in 'categoryId' field",
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

                            const result = await expect(
                                removeSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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

                            const result = await expect(
                                removeSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

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
                                'nonExistent',
                                0,
                                'Category',
                                inactiveCategory.id
                            ),
                        ]

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

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
                                        'RemoveSubcategoriesFromCategoryInput'
                                    )
                            )

                            const result = await expect(
                                removeSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

                            await expectNoRemoves(catsToEdit)
                        })
                    }
                )

                context("when input 'subcategoryIds' is an empty array", () => {
                    it('should throw an ErrorColection', async () => {
                        const catsToEdit = org1Categories
                        const input = buildRemoveSubcategoriesFromCategoryInputArray(
                            catsToEdit.map((c) => c.id),
                            []
                        )

                        const expectedErrors = Array.from(input, (_, index) =>
                            createInputLengthAPIError(
                                'RemoveSubcategoriesFromCategoryInput',
                                'min',
                                'subcategoryIds',
                                index
                            )
                        )

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoRemoves(catsToEdit)
                    })
                })

                context('when there are too many subcategoryIds', () => {
                    it('should throw an ErrorColection', async () => {
                        const catsToEdit = org1Categories
                        const soManySubcats = await Subcategory.save(
                            createSubcategories(
                                config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1,
                                org1
                            )
                        )

                        const input = buildRemoveSubcategoriesFromCategoryInputArray(
                            catsToEdit.map((c) => c.id),
                            soManySubcats.map((s) => s.id)
                        )

                        const expectedErrors = Array.from(input, (_, index) =>
                            createInputLengthAPIError(
                                'RemoveSubcategoriesFromCategoryInput',
                                'max',
                                'subcategoryIds',
                                index
                            )
                        )

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoRemoves(catsToEdit)
                    })
                })

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

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

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
                                'nonExistent',
                                index,
                                'Subcategory',
                                inactiveSubcategory.id
                            )
                        )

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

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
                                i.categoryId
                            )
                        )

                        const result = await expect(
                            removeSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoRemoves(catsToEdit)
                    })
                })
            })
        })

        context('DB calls', () => {
            context(
                'when the categories belong to the same organization',
                () => {
                    it('should do 6 DB calls', async () => {
                        const categories = org1Categories

                        connection.logger.reset()
                        await removeSubcategoriesFromResolver(
                            admin,
                            buildDefaultInput(categories)
                        )

                        const callsToDB = connection.logger.count
                        expect(callsToDB).to.eq(
                            6,
                            '2 for get categories and subcategories; 1 for check permissions; and 3 for save changes'
                        )
                    })
                }
            )

            context(
                'when the categories belong to different organizations',
                () => {
                    it('should do 6 DB calls', async () => {
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
                            6,
                            '2 for get categories and subcategories; 1 for check permissions; and 3 for save changes'
                        )
                    })
                }
            )

            context('when the categories are system', () => {
                it('should do 7 DB calls', async () => {
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
                        7,
                        '2 for get categories and subcategories; 1 for check permissions; and 4 for save changes'
                    )
                })
            })
        })

        context('generateEntityMaps', () => {
            let removeSubcategoriesToCategories: RemoveSubcategoriesFromCategories

            beforeEach(async () => {
                const permissions = new UserPermissions(userToPayload(admin))
                removeSubcategoriesToCategories = new RemoveSubcategoriesFromCategories(
                    [],
                    permissions
                )
            })

            it('returns organization ids', async () => {
                const systemCats = await Category.save(createCategories(5))
                const systemSubcats = createSubcategories(3)
                systemSubcats.forEach((s) => {
                    s.system = true
                })

                await Subcategory.save(systemSubcats)

                const org = await createOrganization().save()
                const cats = await Category.save(createCategories(5, org))

                const otherOrg = await createOrganization().save()
                const otherCats = await Category.save(
                    createCategories(5, otherOrg)
                )

                const expectedIds = [
                    org.organization_id,
                    otherOrg.organization_id,
                ]

                const input = Array.from(
                    [...cats, ...otherCats, ...systemCats],
                    (c) => {
                        return {
                            categoryId: c.id,
                            subcategoryIds: systemSubcats.map((s) => s.id),
                        }
                    }
                )

                const entityMaps = await removeSubcategoriesToCategories.generateEntityMaps(
                    input
                )

                expect(entityMaps.organizationIds).to.deep.equalInAnyOrder(
                    expectedIds
                )
            })

            it('returns existing categories subcategories relations', async () => {
                const org = await createOrganization().save()
                const subcats = await Subcategory.save(
                    createSubcategories(3, org)
                )

                const cats = await Category.save(
                    createCategories(5, org, subcats)
                )

                const inputs = cats.map((c) => {
                    return {
                        categoryId: c.id,
                        subcategoryIds: subcats.slice(1).map((s) => s.id),
                    }
                })

                const expectedCategoriesSubcategories = new Map(
                    cats.map((c) => [c.id, subcats])
                )

                const entityMaps = await removeSubcategoriesToCategories.generateEntityMaps(
                    inputs
                )

                expect(
                    entityMaps.categoriesSubcategories.keys()
                ).to.deep.equalInAnyOrder(
                    expectedCategoriesSubcategories.keys()
                )

                expect(
                    entityMaps.categoriesSubcategories.values()
                ).to.deep.equalInAnyOrder(
                    expectedCategoriesSubcategories.values()
                )
            })
        })
    })
})
