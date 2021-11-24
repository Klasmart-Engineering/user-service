import { expect, use } from 'chai'
import faker from 'faker'
import { Connection } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Subcategory } from '../../src/entities/subcategory'
import { Status } from '../../src/entities/status'
import { createSubcategory } from '../factories/subcategory.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { createUser, createAdminUser } from '../factories/user.factory'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { Model } from '../../src/model'
import { User } from '../../src/entities/user'
import {
    createSubcategoryAPIError,
    createUpdateSubcategoryDuplicateInput,
    deleteSubcategories,
    updateSubcategories,
} from '../../src/resolvers/subcategory'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    DeleteSubcategoryInput,
    SubcategoriesMutationResult,
    UpdateSubcategoryInput,
} from '../../src/types/graphQL/subcategory'
import { userToPayload } from '../utils/operations/userOps'
import { Context } from '../../src/main'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    buildSingleUpdateSubcategoryInput,
    buildUpdateSubcategoryInputArray,
} from '../utils/operations/subcategoryOps'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import { subcategoryConnectionNodeFields } from '../../src/pagination/subcategoriesConnection'
import {
    createInputLengthAPIError,
    MAX_MUTATION_INPUT_ARRAY_SIZE,
} from '../../src/utils/resolvers'
import { NIL_UUID } from '../utils/database'

type NoUpdateProp = 'name' | 'subcategories' | 'both'
use(chaiAsPromised)
use(deepEqualInAnyOrder)

const buildContext = async (permissions: UserPermissions) => {
    return {
        permissions,
    }
}

describe('subcategory', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let org1: Organization
    let org2: Organization
    let deleteSubcategoriesRoleOrg1: Role
    let updateSubcategoriesRoleOrg1: Role
    let subcategoriesOrg1: Subcategory[]
    let subcategoriesOrg2: Subcategory[]
    let systemSubcategories: Subcategory[]
    const orgsPerType = 5
    let admin: User
    let userWithPermission: User
    let userWithoutPermission: User
    let userWithoutMembership: User

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
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

        deleteSubcategoriesRoleOrg1 = await createRole(
            'Delete Subcategories',
            org1,
            {
                permissions: [PermissionName.delete_subjects_20447],
            }
        ).save()
        updateSubcategoriesRoleOrg1 = await createRole(
            'Update Subcategories',
            org1,
            {
                permissions: [PermissionName.edit_subjects_20337],
            }
        ).save()

        await createOrganizationMembership({
            user: userWithPermission,
            organization: org1,
            roles: [deleteSubcategoriesRoleOrg1, updateSubcategoriesRoleOrg1],
        }).save()

        await createOrganizationMembership({
            user: userWithoutPermission,
            organization: org1,
        }).save()
    })

    describe('delete subcategories', () => {
        const deleteCategories = async (
            user: User,
            input: DeleteSubcategoryInput[]
        ) => {
            const permission = new UserPermissions(userToPayload(user))
            const ctx = await buildContext(permission)
            const result = await deleteSubcategories({ input }, ctx as Context)

            return result
        }

        context('invalid input', () => {
            const invalidInput: DeleteSubcategoryInput[] = []
            it('is rejected when input length is more than 50', async () => {
                for (let index = 0; index < 51; index++) {
                    invalidInput.push({ id: 'id-' + index })
                }
                await expect(deleteCategories(admin, invalidInput)).to.be
                    .rejected
            })
        })

        context('inexistent entity/ies', () => {
            it('is rejected when input ids does not exist', async () => {
                const nonExistentIdsInput: DeleteSubcategoryInput[] = []
                for (let index = 0; index < 2; index++) {
                    nonExistentIdsInput.push({ id: faker.datatype.uuid() })
                }
                await expect(deleteCategories(admin, nonExistentIdsInput)).to.be
                    .rejected
            })
            it('is rejected when one input ids does not exist', async () => {
                const oneNonExistentIdsInput: DeleteSubcategoryInput[] = []
                oneNonExistentIdsInput.push({ id: faker.datatype.uuid() })
                oneNonExistentIdsInput.push({ id: subcategoriesOrg1[0].id })
                await expect(deleteCategories(admin, oneNonExistentIdsInput)).to
                    .be.rejected
            })
        })

        context('inactive entity', () => {
            it('is rejected when some entity was already inactive', async () => {
                subcategoriesOrg1[0].status = Status.INACTIVE
                await subcategoriesOrg1[0].save()
                await expect(
                    deleteCategories(admin, [{ id: subcategoriesOrg1[0].id }])
                ).to.be.rejected
            })
        })

        context('not admin', () => {
            it('is rejected when the entity belongs to the system', async () => {
                await expect(
                    deleteCategories(userWithPermission, [
                        { id: systemSubcategories[0].id },
                    ])
                ).to.be.rejected
            })
            it('is rejected when the user has no membership to the org', async () => {
                await expect(
                    deleteCategories(userWithoutMembership, [
                        { id: subcategoriesOrg1[0].id },
                    ])
                ).to.be.rejected
            })
            it('is rejected when the user has no permissions', async () => {
                await expect(
                    deleteCategories(userWithoutPermission, [
                        { id: subcategoriesOrg1[0].id },
                    ])
                ).to.be.rejected
            })
            it('is rejected when the user does not belong to the org', async () => {
                await expect(
                    deleteCategories(userWithPermission, [
                        { id: subcategoriesOrg2[0].id },
                    ])
                ).to.be.rejected
            })
            context('user has permissions', () => {
                let result: SubcategoriesMutationResult
                beforeEach(async () => {
                    result = await deleteCategories(userWithPermission, [
                        { id: subcategoriesOrg1[0].id },
                    ])
                })
                it('retrieves the expected inactivated node', async () => {
                    expect(result.subcategories[0].id).to.equal(
                        subcategoriesOrg1[0].id
                    )
                    expect(result.subcategories[0].status).to.equal('inactive')
                })
                it('soft deletes the item', async () => {
                    const updatedResult = await Subcategory.findByIds([
                        subcategoriesOrg1[0].id,
                    ])
                    expect(updatedResult[0].status).to.equal(Status.INACTIVE)
                    expect(updatedResult[0].deleted_at).not.to.be.null
                })
            })
        })

        context('admin', () => {
            let result: SubcategoriesMutationResult

            context('deleting a subcategory from an organization', () => {
                beforeEach(async () => {
                    result = await deleteCategories(admin, [
                        { id: subcategoriesOrg1[0].id },
                    ])
                })
                it('retrieves the expected inactivated node', async () => {
                    expect(result.subcategories[0].id).to.equal(
                        subcategoriesOrg1[0].id
                    )
                    expect(result.subcategories[0].status).to.equal('inactive')
                })
                it('soft deletes the item', async () => {
                    const updatedResult = await Subcategory.findByIds([
                        subcategoriesOrg1[0].id,
                    ])
                    expect(updatedResult[0].status).to.equal(Status.INACTIVE)
                    expect(updatedResult[0].deleted_at).not.to.be.null
                })
            })

            context('deleting a system category', () => {
                beforeEach(async () => {
                    result = await deleteCategories(admin, [
                        { id: systemSubcategories[0].id },
                    ])
                })
                it('retrieves the expected inactivated node', async () => {
                    expect(result.subcategories[0].id).to.equal(
                        systemSubcategories[0].id
                    )
                    expect(result.subcategories[0].status).to.equal('inactive')
                })
                it('soft deletes the item', async () => {
                    const updatedResult = await Subcategory.findByIds([
                        systemSubcategories[0].id,
                    ])
                    expect(updatedResult[0].status).to.equal(Status.INACTIVE)
                    expect(updatedResult[0].deleted_at).not.to.be.null
                })
            })
        })
    })

    context('updateSubcategories', () => {
        const updateSubcategoriesFromResolver = async (
            user: User,
            input: UpdateSubcategoryInput[]
        ) => {
            const permission = new UserPermissions(userToPayload(user))
            const ctx = await buildContext(permission)
            const result = await updateSubcategories({ input }, ctx)
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
            subcategories.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.name).to.eq(input[i].name)
            })

            const subcategoriesDB = await findSubcategoriesByIds(
                input.map((i) => i.id)
            )

            expect(subcategoriesDB.length).to.eq(input.length)
            subcategoriesDB.forEach((cdb) => {
                const inputRelated = input.find((i) => i.id === cdb.id)
                expect(inputRelated).to.exist
                expect(cdb.name).to.eq(inputRelated?.name)
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

            subcategoriesDB.forEach(async (cdb) => {
                const inputRelated = input.find((i) => i.id === cdb.id)
                const subcategoryRelated = subcategoriesToUpdate.find(
                    (c) => c.id === cdb.id
                )

                expect(inputRelated).to.exist
                expect(subcategoryRelated).to.exist
                expect(cdb.name).to.eq(
                    avoidNames ? subcategoryRelated?.name : inputRelated?.name
                )
            })
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

        const expectErrorCollectionFromInput = async (
            user: User,
            input: UpdateSubcategoryInput[],
            expectedErrors: APIError[]
        ) => {
            const operation = updateSubcategoriesFromResolver(user, input)
            const response = (await expect(operation).to.be
                .rejected) as APIErrorCollection

            const { errors } = response
            expect(errors).to.exist
            expect(errors).to.be.an('array')

            errors.forEach((e, i) => {
                compareErrors(e, expectedErrors[i])
            })
        }

        const expectErrorCollectionFromSubcategories = async (
            user: User,
            subcategoriesToUpdate: Subcategory[],
            expectedErrors: APIError[]
        ) => {
            const input = buildUpdateSubcategoryInputArray(
                subcategoriesToUpdate.map((c) => c.id)
            )

            await expectErrorCollectionFromInput(user, input, expectedErrors)
        }

        const expectAPIError = async (
            user: User,
            subcategoriesToUpdate: Subcategory[],
            expectedError: APIError
        ) => {
            const input = buildUpdateSubcategoryInputArray(
                subcategoriesToUpdate.map((c) => c.id)
            )

            const operation = updateSubcategoriesFromResolver(user, input)
            const error = (await expect(operation).to.be.rejected) as APIError

            expect(error).to.exist
            compareErrors(error, expectedError)
        }

        const expectNoChangesMade = async (categoriesToFind: Subcategory[]) => {
            const ids = categoriesToFind.map((c) => c.id)
            const categoriesDB = await Subcategory.createQueryBuilder(
                'Subcategory'
            )
                .select([...subcategoryConnectionNodeFields])
                .where('Subcategory.id IN (:...ids)', {
                    ids,
                })
                .getMany()

            expect(categoriesDB).to.exist
            expect(categoriesDB.length).to.eq(categoriesToFind.length)
            categoriesToFind.forEach(async (c, i) => {
                const categoryRelated = categoriesDB.find(
                    (cdb) => c.id === cdb.id
                )

                expect(categoryRelated?.name).to.eq(c.name)
                expect(categoryRelated?.status).to.eq(c.status)
            })
        }

        context('permissions', () => {
            context('succesfull cases', () => {
                context('when user is admin', () => {
                    it('should update any subcategory', async () => {
                        await expectSubcategoriesFromSubcategories(admin, [
                            systemSubcategories[0],
                            subcategoriesOrg1[0],
                            subcategoriesOrg2[0],
                        ])
                    })
                })

                context('when user is not admin', () => {
                    context('but has permission', () => {
                        it('should update subcategories in its organization', async () => {
                            await expectSubcategoriesFromSubcategories(
                                userWithPermission,
                                subcategoriesOrg1
                            )
                        })
                    })
                })
            })

            context('error handling', () => {
                context('when user has permission', () => {
                    context('and tries to update system subcategories', () => {
                        it('should throw an ErrorCollection', async () => {
                            const subcatsToUpdate = systemSubcategories
                            const expectedErrors = Array.from(
                                subcatsToUpdate,
                                (_, index) =>
                                    createSubcategoryAPIError(
                                        'unauthorized',
                                        index,
                                        subcatsToUpdate[index].id
                                    )
                            )

                            await expectErrorCollectionFromSubcategories(
                                userWithPermission,
                                subcatsToUpdate,
                                expectedErrors
                            )

                            await expectNoChangesMade(subcatsToUpdate)
                        })
                    })

                    context(
                        'and tries to update subcategories in a non belonging organization',
                        () => {
                            it('should throw an ErrorCollection', async () => {
                                const subcatsToUpdate = subcategoriesOrg2
                                const expectedErrors = Array.from(
                                    subcatsToUpdate,
                                    (_, index) =>
                                        createSubcategoryAPIError(
                                            'unauthorized',
                                            index,
                                            subcatsToUpdate[index].id
                                        )
                                )

                                await expectErrorCollectionFromSubcategories(
                                    userWithPermission,
                                    subcatsToUpdate,
                                    expectedErrors
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
                                it('should throw an ErrorCollection', async () => {
                                    const subcatsToUpdate = subcategoriesOrg1
                                    const expectedErrors = Array.from(
                                        subcatsToUpdate,
                                        (_, index) =>
                                            createSubcategoryAPIError(
                                                'unauthorized',
                                                index,
                                                subcatsToUpdate[index].id
                                            )
                                    )

                                    await expectErrorCollectionFromSubcategories(
                                        userWithoutPermission,
                                        subcatsToUpdate,
                                        expectedErrors
                                    )

                                    await expectNoChangesMade(subcatsToUpdate)
                                })
                            }
                        )
                    })

                    context('neither has membership', () => {
                        context('and tries to update any subcategories', () => {
                            it('should throw an ErrorCollection', async () => {
                                const subcatsToUpdate = [
                                    systemSubcategories[0],
                                    subcategoriesOrg1[0],
                                    subcategoriesOrg2[0],
                                ]

                                const expectedErrors = Array.from(
                                    subcatsToUpdate,
                                    (_, index) =>
                                        createSubcategoryAPIError(
                                            'unauthorized',
                                            index,
                                            subcatsToUpdate[index].id
                                        )
                                )

                                await expectErrorCollectionFromSubcategories(
                                    userWithoutMembership,
                                    subcatsToUpdate,
                                    expectedErrors
                                )

                                await expectNoChangesMade(subcatsToUpdate)
                            })
                        })
                    })
                })
            })
        })

        context('inputs', () => {
            context('succesfull cases', () => {
                context(
                    'when the received name already exists in system subcategories',
                    () => {
                        it('should update the category', async () => {
                            const input = [
                                buildSingleUpdateSubcategoryInput(
                                    subcategoriesOrg1[0].id,
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
                        it('should update the subcategory', async () => {
                            const input = [
                                buildSingleUpdateSubcategoryInput(
                                    subcategoriesOrg1[0].id,
                                    subcategoriesOrg2[0].name
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
                            subcategoriesOrg1,
                            'name'
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

                        await expectAPIError(admin, [], expectedError)
                        // no expecting for no changes because nothing was sent
                    })
                })

                context(
                    `when input length is greather than ${MAX_MUTATION_INPUT_ARRAY_SIZE}`,
                    () => {
                        it('should throw an APIError', async () => {
                            const subcategoryToUpdate = subcategoriesOrg1[0]
                            const catsToUpdate = Array.from(
                                new Array(MAX_MUTATION_INPUT_ARRAY_SIZE + 1),
                                () => subcategoryToUpdate
                            )

                            const expectedError = createInputLengthAPIError(
                                'Subcategory',
                                'max'
                            )

                            await expectAPIError(
                                admin,
                                catsToUpdate,
                                expectedError
                            )

                            await expectNoChangesMade([subcategoryToUpdate])
                        })
                    }
                )

                context(
                    "when input provided has duplicates in 'id' field",
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const categoryToRepeat = subcategoriesOrg1[0]
                            const input = Array.from(new Array(3), (_, i) =>
                                buildSingleUpdateSubcategoryInput(
                                    categoryToRepeat.id,
                                    `Renamed Subcategory ${i + 1}`
                                )
                            )

                            const expectedErrors = Array.from(
                                [input[1], input[2]],
                                (_, index) => {
                                    return createUpdateSubcategoryDuplicateInput(
                                        index + 1,
                                        'id'
                                    )
                                }
                            )

                            await expectErrorCollectionFromInput(
                                admin,
                                input,
                                expectedErrors
                            )

                            await expectNoChangesMade([categoryToRepeat])
                        })
                    }
                )

                context(
                    'when a subcategory with the received id does not exist',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const existentCatsToUpdate = [
                                subcategoriesOrg1[0],
                                subcategoriesOrg2[0],
                            ]

                            const nonExistentSubCategoryId = NIL_UUID
                            const input = [
                                buildSingleUpdateSubcategoryInput(
                                    nonExistentSubCategoryId,
                                    'Renamed Subcategory'
                                ),
                                buildSingleUpdateSubcategoryInput(
                                    existentCatsToUpdate[0].id,
                                    'Renamed Subcategory 2'
                                ),
                                buildSingleUpdateSubcategoryInput(
                                    existentCatsToUpdate[1].id,
                                    'Renamed Subcategory 3'
                                ),
                            ]

                            const expectedErrors = [
                                createSubcategoryAPIError(
                                    'nonExistent',
                                    0,
                                    nonExistentSubCategoryId
                                ),
                            ]

                            await expectErrorCollectionFromInput(
                                admin,
                                input,
                                expectedErrors
                            )

                            await expectNoChangesMade(existentCatsToUpdate)
                        })
                    }
                )

                context('when the received subcategory is inactive', () => {
                    let inactiveSubcategory: Subcategory

                    beforeEach(async () => {
                        inactiveSubcategory = subcategoriesOrg1[0]
                        inactiveSubcategory.status = Status.INACTIVE
                        await inactiveSubcategory.save()
                    })

                    it('should throw an ErrorCollection', async () => {
                        const catsToUpdate = subcategoriesOrg1
                        const expectedErrors = Array.from(
                            catsToUpdate,
                            (_, index) => {
                                return createSubcategoryAPIError(
                                    'inactive',
                                    index,
                                    inactiveSubcategory.id
                                )
                            }
                        )

                        await expectErrorCollectionFromSubcategories(
                            admin,
                            catsToUpdate,
                            expectedErrors
                        )

                        await expectNoChangesMade(catsToUpdate)
                    })
                })

                context(
                    'when the received name already exist in another subcategory',
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const subcatsToUpdate = subcategoriesOrg1.slice(
                                0,
                                3
                            )
                            const input = Array.from(subcatsToUpdate, (c, i) =>
                                buildSingleUpdateSubcategoryInput(
                                    c.id,
                                    subcategoriesOrg1[i + 1].name
                                )
                            )

                            const expectedErrors = Array.from(
                                subcatsToUpdate,
                                (c, index) => {
                                    return createSubcategoryAPIError(
                                        'duplicate',
                                        index,
                                        subcategoriesOrg1[index + 1].name
                                    )
                                }
                            )

                            await expectErrorCollectionFromInput(
                                admin,
                                input,
                                expectedErrors
                            )

                            await expectNoChangesMade(subcatsToUpdate)
                        })
                    }
                )
            })
        })
    })
})
