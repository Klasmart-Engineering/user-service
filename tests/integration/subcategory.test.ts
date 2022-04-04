import { expect, use } from 'chai'
import faker from 'faker'
import { getConnection } from 'typeorm'
import { TestConnection } from '../utils/testConnection'
import { Subcategory } from '../../src/entities/subcategory'
import { Status } from '../../src/entities/status'
import {
    createSubcategories as createMultipleSubcategoriesFactory,
    createSubcategory,
} from '../factories/subcategory.factory'
import { createUser, createAdminUser } from '../factories/user.factory'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { User } from '../../src/entities/user'
import {
    CreateSubcategories,
    DeleteSubcategories,
    UpdateSubcategories,
} from '../../src/resolvers/subcategory'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    CreateSubcategoryInput,
    DeleteSubcategoryInput,
    SubcategoriesMutationResult,
    UpdateSubcategoryInput,
    SubcategoryConnectionNode,
} from '../../src/types/graphQL/subcategory'
import { userToPayload } from '../utils/operations/userOps'
import { Organization } from '../../src/entities/organization'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    buildDeleteSubcategoryInputArray,
    buildSingleUpdateSubcategoryInput,
    buildUpdateSubcategoryInputArray,
} from '../utils/operations/subcategoryOps'
import { subcategoryConnectionNodeFields } from '../../src/pagination/subcategoriesConnection'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
    createInputLengthAPIError,
} from '../../src/utils/resolvers/errors'
import { NIL_UUID } from '../utils/database'
import { config } from '../../src/config/config'
import { permErrorMeta } from '../utils/errors'
import { mutate } from '../../src/utils/mutations/commonStructure'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { compareErrors, compareMultipleErrors } from '../utils/apiError'
import { buildSingleUpdateCategoryInput } from '../utils/operations/categoryOps'

type NoUpdateProp = 'name' | 'subcategories' | 'both'
use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('subcategory', () => {
    let connection: TestConnection
    let org1: Organization
    let org2: Organization
    let systemSubcategories: Subcategory[]
    let admin: User
    let userWithPermission: User
    let userWithoutPermission: User
    let userWithoutMembership: User
    const subcategoriesCount = 5
    let org1Subcategories: Subcategory[]
    let org2Subcategories: Subcategory[]
    let subcategoriesTotalCount = 0

    const expectSubcategories = async (quantity: number) => {
        const subcategoryCount = await Subcategory.count({
            where: { status: Status.ACTIVE },
        })

        expect(subcategoryCount).to.eq(quantity)
    }

    const createInitialSubcategories = async () => {
        await SubcategoriesInitializer.run()
        systemSubcategories = await Subcategory.find({
            take: subcategoriesCount,
        })

        org1Subcategories = await Subcategory.save(
            Array.from(new Array(subcategoriesCount), () =>
                createSubcategory(org1)
            )
        )

        org2Subcategories = await Subcategory.save(
            Array.from(new Array(subcategoriesCount), () =>
                createSubcategory(org2)
            )
        )

        subcategoriesTotalCount = await Subcategory.count()
    }

    const generateExistingSubcategories = async (org: Organization) => {
        const existingSubcategory = await createSubcategory(org).save()
        const nonPermittedOrgSubcategory = await createSubcategory(
            await createOrganization().save()
        ).save()

        const inactiveCategory = createSubcategory(org)
        inactiveCategory.status = Status.INACTIVE
        await inactiveCategory.save()

        const inactiveOrg = createOrganization()
        inactiveOrg.status = Status.INACTIVE
        await inactiveOrg.save()
        const inactiveOrgSubcategory = await createSubcategory(
            inactiveOrg
        ).save()

        return [
            existingSubcategory,
            nonPermittedOrgSubcategory,
            inactiveCategory,
            inactiveOrgSubcategory,
        ]
    }

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
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

        // Creating Role for create subcategories
        const createSubcategoriesRole = await createRole(
            'Create Subcategories',
            org1,
            {
                permissions: [PermissionName.create_subjects_20227],
            }
        ).save()

        // Creating Role for delete subcategories
        const deleteSubcategoriesRole = await createRole(
            'Delete Subcategories',
            org1,
            {
                permissions: [PermissionName.delete_subjects_20447],
            }
        ).save()

        // Creating Role for update subcategories
        const updateSubcategoriesRole = await createRole(
            'Update Subcategories',
            org1,
            {
                permissions: [PermissionName.edit_subjects_20337],
            }
        ).save()

        // Assigning userWithPermission to org1 with the createSubcategoriesRole
        await createOrganizationMembership({
            user: userWithPermission,
            organization: org1,
            roles: [
                createSubcategoriesRole,
                updateSubcategoriesRole,
                deleteSubcategoriesRole,
            ],
        }).save()

        // Assigning userWithoutPermission to org1
        await createOrganizationMembership({
            user: userWithoutPermission,
            organization: org1,
        }).save()
    })

    context('CreateSubcategories', () => {
        let createSubcategories: CreateSubcategories
        let permissions: UserPermissions

        const createSubcategoriesFromResolver = async (
            user: User,
            input: CreateSubcategoryInput[]
        ) => {
            permissions = new UserPermissions(userToPayload(user))
            const result: SubcategoriesMutationResult = await mutate(
                CreateSubcategories,
                { input },
                permissions
            )

            return result
        }

        const buildCreateSubcategoryInput = (
            name: string,
            org: Organization
        ): CreateSubcategoryInput => {
            return {
                name,
                organizationId: org.organization_id,
            }
        }

        const generateInput = (size: number, org: Organization) => {
            return Array.from(Array(size), (_, i) =>
                buildCreateSubcategoryInput(`Subcategory ${i + 1}`, org)
            )
        }

        const findSubcategoriesByInput = async (
            input: CreateSubcategoryInput[]
        ): Promise<CreateSubcategoryInput[]> => {
            const subcategories = await Subcategory.createQueryBuilder(
                'Subcategory'
            )
                .select(['Subcategory.name', 'Organization.organization_id'])
                .innerJoin('Subcategory.organization', 'Organization')
                .where('Subcategory.name IN (:...inputNames)', {
                    inputNames: input.map((i) => i.name),
                })
                .andWhere('Organization.organization_id IN (:...inputOrgIds)', {
                    inputOrgIds: input.map((i) => i.organizationId),
                })
                .orderBy('Subcategory.name')
                .addOrderBy('Organization.organization_name')
                .getMany()

            return subcategories.map((c) => {
                return {
                    name: c.name as string,
                    organizationId: (c as any).__organization__
                        .organization_id as string,
                }
            })
        }

        const expectSubcategoriesCreated = async (
            user: User,
            input: CreateSubcategoryInput[]
        ) => {
            const { subcategories } = await createSubcategoriesFromResolver(
                user,
                input
            )

            expect(subcategories.length).to.eq(input.length)

            const inputNames = input.map((i) => i.name)
            const subcategoriesCreatedNames = subcategories.map(
                (sc: SubcategoryConnectionNode) => sc.name
            )
            expect(subcategoriesCreatedNames).to.deep.equalInAnyOrder(
                inputNames
            )

            const subcategoriesDB = await findSubcategoriesByInput(input)
            subcategoriesDB.forEach((sdb, i) => {
                expect(sdb.name).to.include(input[i].name)
                expect(sdb.organizationId).to.eq(input[i].organizationId)
            })
        }

        beforeEach(async () => {
            permissions = new UserPermissions(userToPayload(admin))
            createSubcategories = new CreateSubcategories([], permissions)
        })

        context('when user is admin', () => {
            it('should create subcategories in any organization', async () => {
                const input = [
                    ...generateInput(1, org1),
                    ...generateInput(1, org2),
                ]

                await expectSubcategoriesCreated(admin, input)
            })
        })

        context('when user is not admin but has permission', () => {
            it('should create subcategories in the organization which they belong to', async () => {
                const input = generateInput(2, org1)
                await expectSubcategoriesCreated(userWithPermission, input)
            })
        })

        context('DB calls', () => {
            const getDbCallCount = async (input: CreateSubcategoryInput[]) => {
                connection.logger.reset()
                await mutate(CreateSubcategories, { input }, permissions)
                return connection.logger.count
            }

            const resetSubcategories = async () => {
                const createdSubcats = await Subcategory.find({
                    where: { status: Status.ACTIVE },
                })

                await Promise.all(
                    createdSubcats.map((s) => s.inactivate(connection.manager))
                )

                await Subcategory.save(createdSubcats)
            }

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount(generateInput(1, org1)) // warm up permissions cache
                await resetSubcategories()

                const singleSubcategoryCount = await getDbCallCount(
                    generateInput(1, org1)
                )
                await resetSubcategories()

                const twoSubcategoriesCount = await getDbCallCount(
                    generateInput(2, org1)
                )
                await resetSubcategories()

                expect(twoSubcategoriesCount).to.be.eq(singleSubcategoryCount)
            })
        })

        context('generateEntityMaps', () => {
            it('returns existing subcategories', async () => {
                const existingSubcategories = await generateExistingSubcategories(
                    org1
                )

                const expectedPairs = await Promise.all(
                    existingSubcategories
                        .filter(
                            (es: Subcategory) => es.status === Status.ACTIVE
                        )
                        .map(async (es: Subcategory) => {
                            return {
                                organizationId: (await es.organization)!
                                    .organization_id,
                                name: es.name!,
                            }
                        })
                )

                const input: CreateSubcategoryInput[] = [
                    ...expectedPairs.map((ep) => {
                        return {
                            organizationId: ep.organizationId,
                            name: ep.name,
                        }
                    }),
                    ...generateInput(1, org1),
                ]

                const entityMaps = await createSubcategories.generateEntityMaps(
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
                'when non admin tries to create subcategories in an organization which does not belong',
                () => {
                    it('throws a permission error', async () => {
                        const user = userWithPermission
                        const input = generateInput(2, org2)
                        const operation = createSubcategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [org2])
                        )

                        await expectSubcategories(0)
                    })
                }
            )

            context(
                'when a user without permission tries to create subcategories in the organization which belongs',
                () => {
                    it('throws a permission error', async () => {
                        const user = userWithoutMembership
                        const input = generateInput(2, org1)
                        const operation = createSubcategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [org1])
                        )

                        await expectSubcategories(0)
                    })
                }
            )

            context(
                'when non member tries to create subcategories in any organization',
                () => {
                    it('throws a permission error', async () => {
                        const user = userWithoutMembership
                        const input = [
                            ...generateInput(1, org1),
                            ...generateInput(1, org2),
                        ]

                        const operation = createSubcategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [org1, org2])
                        )

                        await expectSubcategories(0)
                    })
                }
            )

            context('when user sends an empty array as input', () => {
                it('throws an APIError', async () => {
                    const expectedError = createInputLengthAPIError(
                        'Subcategory',
                        'min'
                    )

                    const input = generateInput(0, org1)
                    const result = await expect(
                        createSubcategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareErrors(result, expectedError)

                    await expectSubcategories(0)
                })
            })

            context(
                `when user tries to create more than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE} subcategories`,
                () => {
                    it('throws an APIError', async () => {
                        const expectedError = createInputLengthAPIError(
                            'Subcategory',
                            'max'
                        )

                        const input = generateInput(
                            config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1,
                            org1
                        )

                        const result = await expect(
                            createSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareErrors(result, expectedError)
                        await expectSubcategories(0)
                    })
                }
            )

            context(
                'when user tries to create subcategories in an organization which does not exist',
                () => {
                    it('throws an ErrorCollection', async () => {
                        const input = Array.from(Array(2), (_, i) => {
                            return {
                                name: `Subcategory ${i + 1}`,
                                organizationId: NIL_UUID,
                            }
                        })

                        const expectedErrors = Array.from(input, (i, index) =>
                            createEntityAPIError(
                                'nonExistent',
                                index,
                                'Organization',
                                i.organizationId
                            )
                        )

                        const result = await expect(
                            createSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectSubcategories(0)
                    })
                }
            )

            context('when the subcategories to create are duplicated', () => {
                it('throws an ErrorCollection', async () => {
                    const input = [
                        ...generateInput(1, org1),
                        ...generateInput(1, org1),
                        ...generateInput(1, org1),
                    ]

                    const expectedErrors = Array.from(
                        [input[1], input[2]],
                        (_, index) =>
                            createDuplicateAttributeAPIError(
                                index + 1,
                                ['name'],
                                'CreateSubcategoryInput'
                            )
                    )

                    const result = await expect(
                        createSubcategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)

                    await expectSubcategories(0)
                })
            })

            context('when the subcategory to create already exists', () => {
                let input: CreateSubcategoryInput[]
                let existentSubcategory: SubcategoryConnectionNode

                beforeEach(async () => {
                    input = generateInput(1, org1)
                    const subcategoriesResult = await createSubcategoriesFromResolver(
                        admin,
                        input
                    )
                    existentSubcategory = subcategoriesResult.subcategories[0]
                })

                it('throws an ErrorCollection', async () => {
                    const expectedErrors = Array.from(input, (i, index) =>
                        createExistentEntityAttributeAPIError(
                            'Subcategory',
                            existentSubcategory.id,
                            'name',
                            i.name,
                            index
                        )
                    )

                    const result = await expect(
                        createSubcategoriesFromResolver(admin, input)
                    ).to.be.rejected

                    compareMultipleErrors(result.errors, expectedErrors)

                    // The already existent category is the only expected
                    await expectSubcategories(1)
                })
            })
        })
    })

    context('UpdateSubcategories', () => {
        let permissions: UserPermissions
        let updateSubcategories: UpdateSubcategories

        const updateSubcategoriesFromResolver = async (
            user: User,
            input: UpdateSubcategoryInput[]
        ) => {
            permissions = new UserPermissions(userToPayload(user))
            const result: SubcategoriesMutationResult = await mutate(
                UpdateSubcategories,
                { input },
                permissions
            )

            return result
        }

        const findSubcategoriesByIds = async (
            ids: string[]
        ): Promise<UpdateSubcategoryInput[]> => {
            const subcategories = await Subcategory.createQueryBuilder(
                'Subcategory'
            )
                .select(['Subcategory.id', 'Subcategory.name'])
                .where('Subcategory.id IN (:...ids)', { ids })
                .getMany()

            return subcategories.map((c) => {
                return {
                    id: c.id,
                    name: c.name,
                }
            })
        }

        const expectSubcategoriesFromInput = async (
            user: User,
            input: UpdateSubcategoryInput[]
        ) => {
            const { subcategories } = await updateSubcategoriesFromResolver(
                user,
                input
            )

            expect(subcategories.length).to.eq(input.length)
            subcategories.forEach((s, i) => {
                expect(s.id).to.eq(input[i].id)
                expect(s.name).to.eq(input[i].name)
            })

            const subcategoriesDB = await findSubcategoriesByIds(
                input.map((i) => i.id)
            )

            expect(subcategoriesDB.length).to.eq(input.length)
            subcategoriesDB.forEach((sdb) => {
                const inputRelated = input.find((i) => i.id === sdb.id)
                expect(inputRelated).to.exist
                expect(sdb.name).to.eq(inputRelated?.name)
            })
        }

        const expectSubcategoriesFromSubcategories = async (
            user: User,
            subcategoriesToUpdate: Subcategory[],
            noUpdate?: NoUpdateProp
        ) => {
            const avoidNames = noUpdate === 'name' || noUpdate === 'both'

            const input = buildUpdateSubcategoryInputArray(
                subcategoriesToUpdate.map((c) => c.id),
                avoidNames
            )

            const { subcategories } = await updateSubcategoriesFromResolver(
                user,
                input
            )

            expect(subcategories.length).to.eq(input.length)
            subcategories.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.name).to.eq(
                    avoidNames ? subcategoriesToUpdate[i].name : input[i].name
                )
            })

            const subcategoriesDB = await findSubcategoriesByIds(
                input.map((i) => i.id)
            )

            expect(subcategoriesDB.length).to.eq(input.length)

            for (const sdb of subcategoriesDB) {
                const inputRelated = input.find((i) => i.id === sdb.id)
                const subcategoryRelated = subcategoriesToUpdate.find(
                    (c) => c.id === sdb.id
                )

                expect(inputRelated).to.exist
                expect(subcategoryRelated).to.exist
                expect(sdb.name).to.eq(
                    avoidNames ? subcategoryRelated?.name : inputRelated?.name
                )
            }
        }

        const expectNoChangesMade = async (
            subcategoriesToFind: Subcategory[]
        ) => {
            const ids = subcategoriesToFind.map((c) => c.id)
            const subcategoriesDB = await Subcategory.createQueryBuilder(
                'Subcategory'
            )
                .select([...subcategoryConnectionNodeFields])
                .where('Subcategory.id IN (:...ids)', {
                    ids,
                })
                .getMany()

            expect(subcategoriesDB).to.exist
            expect(subcategoriesDB.length).to.eq(subcategoriesToFind.length)
            for (const [i, s] of subcategoriesToFind.entries()) {
                const subcategoryRelated = subcategoriesDB.find(
                    (sdb) => s.id === sdb.id
                )

                expect(subcategoryRelated?.name).to.eq(s.name)
                expect(subcategoryRelated?.status).to.eq(s.status)
            }
        }

        beforeEach(async () => {
            permissions = new UserPermissions(userToPayload(admin))
            updateSubcategories = new UpdateSubcategories([], permissions)

            await createInitialSubcategories()
        })

        context('permissions', () => {
            context('successful cases', () => {
                context('when user is admin', () => {
                    it('should update any subcategory', async () => {
                        await expectSubcategoriesFromSubcategories(admin, [
                            systemSubcategories[0],
                            org1Subcategories[0],
                            org2Subcategories[0],
                        ])
                    })
                })

                context('when user is not admin', () => {
                    context('but has permission', () => {
                        it('should update subcategories in its organization', async () => {
                            await expectSubcategoriesFromSubcategories(
                                userWithPermission,
                                org1Subcategories
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
                    context('and tries to update system subcategories', () => {
                        it('throws a permission error', async () => {
                            const user = userWithPermission
                            const subcatsToUpdate = systemSubcategories
                            const input = buildUpdateSubcategoryInputArray(
                                subcatsToUpdate.map((c) => c.id)
                            )

                            const operation = updateSubcategoriesFromResolver(
                                user,
                                input
                            )

                            await expect(operation).to.be.rejectedWith(
                                permError(user)
                            )

                            await expectNoChangesMade(subcatsToUpdate)
                        })
                    })

                    context(
                        'and tries to update subcategories in a non belonging organization',
                        () => {
                            it('throws a permission error', async () => {
                                const user = userWithPermission
                                const subcatsToUpdate = org2Subcategories
                                const input = buildUpdateSubcategoryInputArray(
                                    subcatsToUpdate.map((c) => c.id)
                                )

                                const operation = updateSubcategoriesFromResolver(
                                    user,
                                    input
                                )

                                await expect(operation).to.be.rejectedWith(
                                    permError(user, [org2])
                                )

                                await expectNoChangesMade(subcatsToUpdate)
                            })
                        }
                    )
                })

                context('when user has not permission', () => {
                    context('but has membership', () => {
                        context(
                            'and tries to update subcategories in its organization',
                            () => {
                                it('throws a permission error', async () => {
                                    const user = userWithoutPermission
                                    const subcatsToUpdate = org1Subcategories
                                    const input = buildUpdateSubcategoryInputArray(
                                        subcatsToUpdate.map((c) => c.id)
                                    )

                                    const operation = updateSubcategoriesFromResolver(
                                        user,
                                        input
                                    )

                                    await expect(operation).to.be.rejectedWith(
                                        permError(user, [org1])
                                    )

                                    await expectNoChangesMade(subcatsToUpdate)
                                })
                            }
                        )
                    })

                    context('neither has membership', () => {
                        context('and tries to update any subcategories', () => {
                            it('throws a permission error', async () => {
                                const user = userWithoutMembership
                                const subcatsToUpdate = [
                                    systemSubcategories[0],
                                    org1Subcategories[0],
                                    org2Subcategories[0],
                                ]

                                const input = buildUpdateSubcategoryInputArray(
                                    subcatsToUpdate.map((s) => s.id)
                                )

                                const operation = updateSubcategoriesFromResolver(
                                    user,
                                    input
                                )

                                await expect(operation).to.be.rejectedWith(
                                    permError(user)
                                )

                                await expectNoChangesMade(subcatsToUpdate)
                            })
                        })
                    })
                })
            })
        })

        context('inputs', () => {
            context('successful cases', () => {
                context(
                    'when the received name already exists in system subcategories',
                    () => {
                        it('should update the subcategory', async () => {
                            const input = [
                                buildSingleUpdateSubcategoryInput(
                                    org1Subcategories[0].id,
                                    systemSubcategories[0].name
                                ),
                            ]

                            await expectSubcategoriesFromInput(admin, input)
                        })
                    }
                )

                context(
                    'when the received name already exists in another organization',
                    () => {
                        it('should update the category', async () => {
                            const input = [
                                buildSingleUpdateSubcategoryInput(
                                    org1Subcategories[0].id,
                                    org2Subcategories[0].name
                                ),
                            ]

                            await expectSubcategoriesFromInput(admin, input)
                        })
                    }
                )
                context('when just name is provided', () => {
                    it('should just update names', async () => {
                        await expectSubcategoriesFromSubcategories(
                            admin,
                            org1Subcategories,
                            'name'
                        )
                    })
                })

                context('when just subcategories are provided', () => {
                    it('should just update names', async () => {
                        await expectSubcategoriesFromSubcategories(
                            admin,
                            org1Subcategories
                        )
                    })
                })
            })

            context('error handling', () => {
                context('when input provided is an empty array', () => {
                    it('should throw an APIError', async () => {
                        const expectedError = createInputLengthAPIError(
                            'Subcategory',
                            'min'
                        )

                        const input = buildUpdateSubcategoryInputArray([])

                        const result = await expect(
                            updateSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareErrors(result, expectedError)
                        // no expecting for no changes because nothing was sent
                    })
                })

                context(
                    `when input length is greater than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE}`,
                    () => {
                        it('should throw an APIError', async () => {
                            const subcategoryToUpdate = org1Subcategories[0]
                            const subcatsToUpdate = Array.from(
                                new Array(
                                    config.limits
                                        .MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                                ),
                                () => subcategoryToUpdate
                            )
                            const expectedError = createInputLengthAPIError(
                                'Subcategory',
                                'max'
                            )

                            const input = buildUpdateSubcategoryInputArray(
                                subcatsToUpdate.map((c) => c.id)
                            )

                            const result = await expect(
                                updateSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareErrors(result, expectedError)
                            await expectNoChangesMade([subcategoryToUpdate])
                        })
                    }
                )

                context(
                    "when input provided has duplicates in 'id' field",
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const subcategoryToRepeat = org1Subcategories[0]
                            const input = Array.from(new Array(3), (_, i) =>
                                buildSingleUpdateSubcategoryInput(
                                    subcategoryToRepeat.id,
                                    `Renamed Subcategory ${i + 1}`
                                )
                            )

                            const expectedErrors = Array.from(
                                [input[1], input[2]],
                                (_, index) => {
                                    return createDuplicateAttributeAPIError(
                                        index + 1,
                                        ['id'],
                                        'UpdateSubcategoryInput'
                                    )
                                }
                            )

                            const result = await expect(
                                updateSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

                            await expectNoChangesMade([subcategoryToRepeat])
                        })
                    }
                )

                context(
                    'when a subcategory with the received id does not exist',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const existentSubcatsToUpdate = [
                                org1Subcategories[0],
                                org2Subcategories[0],
                            ]

                            const nonExistentSubcategoryId = NIL_UUID
                            const input = [
                                buildSingleUpdateSubcategoryInput(
                                    nonExistentSubcategoryId,
                                    'Renamed Subcategory'
                                ),
                                buildSingleUpdateSubcategoryInput(
                                    existentSubcatsToUpdate[0].id,
                                    'Renamed Subcategory 2'
                                ),
                                buildSingleUpdateSubcategoryInput(
                                    existentSubcatsToUpdate[1].id,
                                    'Renamed Subcategory 3'
                                ),
                            ]

                            const expectedErrors = [
                                createEntityAPIError(
                                    'nonExistent',
                                    0,
                                    'Subcategory',
                                    nonExistentSubcategoryId
                                ),
                            ]

                            const result = await expect(
                                updateSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

                            await expectNoChangesMade(existentSubcatsToUpdate)
                        })
                    }
                )

                context('when the received subcategory is inactive', () => {
                    let inactiveSubcategory: Subcategory

                    beforeEach(async () => {
                        inactiveSubcategory = org1Subcategories[0]
                        inactiveSubcategory.status = Status.INACTIVE
                        await inactiveSubcategory.save()
                    })

                    it('should throw an ErrorCollection', async () => {
                        const subcatsToUpdate = org1Subcategories
                        const expectedErrors = [
                            createEntityAPIError(
                                'nonExistent',
                                0,
                                'Subcategory',
                                inactiveSubcategory.id
                            ),
                        ]

                        const input = buildUpdateSubcategoryInputArray(
                            subcatsToUpdate.map((c) => c.id)
                        )

                        const result = await expect(
                            updateSubcategoriesFromResolver(admin, input)
                        ).to.be.rejected

                        compareMultipleErrors(result.errors, expectedErrors)

                        await expectNoChangesMade(subcatsToUpdate)
                    })
                })

                context(
                    'when the received name already exist in another subcategory',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const subcatsToUpdate = org1Subcategories.slice(
                                0,
                                3
                            )
                            const input = Array.from(subcatsToUpdate, (s, i) =>
                                buildSingleUpdateCategoryInput(
                                    s.id,
                                    org1Subcategories[i + 1].name
                                )
                            )

                            const expectedErrors = Array.from(
                                subcatsToUpdate,
                                (_, index) => {
                                    return createExistentEntityAttributeAPIError(
                                        'Subcategory',
                                        org1Subcategories[index + 1].id,
                                        'name',
                                        org1Subcategories[index + 1].name!,
                                        index
                                    )
                                }
                            )

                            const result = await expect(
                                updateSubcategoriesFromResolver(admin, input)
                            ).to.be.rejected

                            compareMultipleErrors(result.errors, expectedErrors)

                            await expectNoChangesMade(subcatsToUpdate)
                        })
                    }
                )
            })
        })

        context('DB calls', () => {
            const getDbCallCount = async (input: UpdateSubcategoryInput[]) => {
                connection.logger.reset()
                await mutate(UpdateSubcategories, { input }, permissions)
                return connection.logger.count
            }

            it('db connections do not increase with number of input elements', async () => {
                // warm up permissions cache
                await getDbCallCount(
                    buildUpdateSubcategoryInputArray(
                        [org1Subcategories[0].id],
                        true
                    )
                )

                const singleCategoryCount = await getDbCallCount(
                    buildUpdateSubcategoryInputArray(
                        [org1Subcategories[1].id],
                        true
                    )
                )

                const multipleCategoriesCount = await getDbCallCount(
                    buildUpdateSubcategoryInputArray(
                        org1Subcategories.map((s) => s.id),
                        true
                    )
                )

                expect(multipleCategoriesCount).to.be.eq(singleCategoryCount)
            })
        })

        context('generateEntityMaps', () => {
            it('returns organization ids', async () => {
                const systemSubcats = await Subcategory.save(
                    createMultipleSubcategoriesFactory(5)
                )

                const otherOrg = await createOrganization().save()
                const otherSubcats = await Subcategory.save(
                    createMultipleSubcategoriesFactory(5, otherOrg)
                )

                const expectedIds = [
                    org1.organization_id,
                    otherOrg.organization_id,
                ]

                const input = buildUpdateSubcategoryInputArray(
                    [
                        ...org1Subcategories,
                        ...otherSubcats,
                        ...systemSubcats,
                    ].map((c) => c.id)
                )

                const entityMaps = await updateSubcategories.generateEntityMaps(
                    input
                )

                expect(entityMaps.organizationIds).to.deep.equalInAnyOrder(
                    expectedIds
                )
            })

            it('returns existing subcategories', async () => {
                const existingSubcategories = await generateExistingSubcategories(
                    org1
                )
                const expectedPairs = await Promise.all(
                    existingSubcategories
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

                const input: UpdateSubcategoryInput[] = [
                    ...expectedPairs.map((ep) => {
                        return {
                            id: ep.id,
                            name: ep.name,
                        }
                    }),
                    {
                        id: org1Subcategories[0].id,
                        name: faker.random.word(),
                    },
                ]

                const entityMaps = await updateSubcategories.generateEntityMaps(
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

    context('DeleteSubcategories', () => {
        const deleteSubcategoriesFromResolver = async (
            user: User,
            input: DeleteSubcategoryInput[]
        ): Promise<SubcategoriesMutationResult> => {
            const permissions = new UserPermissions(userToPayload(user))
            return mutate(DeleteSubcategories, { input }, permissions)
        }

        const expectSubcategoriesDeleted = async (
            user: User,
            subcatsToDelete: Subcategory[]
        ) => {
            const input = buildDeleteSubcategoryInputArray(subcatsToDelete)
            const { subcategories } = await deleteSubcategoriesFromResolver(
                user,
                input
            )

            expect(subcategories).to.have.lengthOf(input.length)
            subcategories.forEach((s, i) => {
                expect(s.id).to.eq(input[i].id)
                expect(s.status).to.eq(Status.INACTIVE)
            })

            const subcategoriesDB = await Subcategory.findByIds(
                input.map((i) => i.id)
            )

            expect(subcategoriesDB).to.have.lengthOf(input.length)
            subcategoriesDB.forEach((sdb) => {
                const inputRelated = input.find((i) => i.id === sdb.id)
                expect(inputRelated).to.exist
                expect(sdb.id).to.eq(inputRelated?.id)
                expect(sdb.status).to.eq(Status.INACTIVE)
            })
        }

        beforeEach(async () => {
            await createInitialSubcategories()
        })

        context('when user is admin', () => {
            it('should delete any category', async () => {
                const subcatsToDelete = [
                    systemSubcategories[0],
                    org1Subcategories[0],
                    org2Subcategories[0],
                ]

                await expectSubcategoriesDeleted(admin, subcatsToDelete)
                await expectSubcategories(
                    subcategoriesTotalCount - subcatsToDelete.length
                )
            })
        })

        context('when user is not admin', () => {
            let user: User
            const permError = permErrorMeta(
                PermissionName.delete_subjects_20447
            )

            context('and has permission', () => {
                it('should delete subcategories in its organization', async () => {
                    const subcatsToDelete = org1Subcategories
                    await expectSubcategoriesDeleted(
                        userWithPermission,
                        subcatsToDelete
                    )

                    await expectSubcategories(
                        subcategoriesTotalCount - subcatsToDelete.length
                    )
                })
            })

            context('and has wrong permissions', () => {
                beforeEach(() => {
                    user = userWithPermission
                })

                context('and tries to update system subcategories', () => {
                    it('throws a permission error', async () => {
                        const subcatsToDelete = systemSubcategories
                        const input = buildDeleteSubcategoryInputArray(
                            subcatsToDelete
                        )

                        const operation = deleteSubcategoriesFromResolver(
                            user,
                            input
                        )

                        await expect(operation).to.be.rejectedWith(
                            permError(user)
                        )

                        await expectSubcategories(subcategoriesTotalCount)
                    })
                })

                context(
                    'and tries to update subcategories in an organization which does not belong',
                    () => {
                        it('throws a permission error', async () => {
                            const subcatsToDelete = org2Subcategories
                            const input = buildDeleteSubcategoryInputArray(
                                subcatsToDelete
                            )

                            const operation = deleteSubcategoriesFromResolver(
                                user,
                                input
                            )

                            await expect(operation).to.be.rejectedWith(
                                permError(user, [org2])
                            )

                            await expectSubcategories(subcategoriesTotalCount)
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
                        'and tries to delete subcategories in its organization',
                        () => {
                            it('throws a permission error', async () => {
                                const catsToDelete = org1Subcategories
                                const input = buildDeleteSubcategoryInputArray(
                                    catsToDelete
                                )

                                const operation = deleteSubcategoriesFromResolver(
                                    user,
                                    input
                                )

                                await expect(operation).to.be.rejectedWith(
                                    permError(user, [org1])
                                )

                                await expectSubcategories(
                                    subcategoriesTotalCount
                                )
                            })
                        }
                    )
                })

                context('and does not have membership', () => {
                    beforeEach(() => {
                        user = userWithoutMembership
                    })

                    context('and tries to delete any subcategories', () => {
                        it('throws a permission error', async () => {
                            const subcatsToDelete = [
                                systemSubcategories[0],
                                org1Subcategories[0],
                                org2Subcategories[0],
                            ]

                            const input = buildDeleteSubcategoryInputArray(
                                subcatsToDelete
                            )

                            const operation = deleteSubcategoriesFromResolver(
                                user,
                                input
                            )

                            await expect(operation).to.be.rejectedWith(
                                permError(user)
                            )

                            await expectSubcategories(subcategoriesTotalCount)
                        })
                    })
                })
            })
        })
    })
})
