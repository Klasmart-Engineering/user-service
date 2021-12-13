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
    updateSubcategories,
    createSubcategories,
    deleteSubcategories,
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
import { createInputLengthAPIError } from '../../src/utils/resolvers'
import { NIL_UUID } from '../utils/database'
import { config } from '../../src/config/config'
import { buildPermissionError } from '../utils/errors'

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

    context('createSubcategories', () => {
        let admin: User
        let userWithPermission: User
        let userWithoutPermission: User
        let userWithoutMembership: User
        let org1: Organization
        let org2: Organization
        let createSubcategoriesRole: Role

        const createSubcategoriesFromResolver = async (
            user: User,
            input: CreateSubcategoryInput[]
        ) => {
            const permission = new UserPermissions(userToPayload(user))
            const ctx = await buildContext(permission)
            const result = await createSubcategories({ input }, ctx)

            return result
        }

        const buildCreateSubcategoryInput = (
            name: string,
            org: Organization
        ) => {
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

        const getPermErrorMessage = (user: User, orgs?: Organization[]) => {
            return buildPermissionError(
                PermissionName.create_subjects_20227,
                user,
                orgs
            )
        }

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

            // Creating Role for create categories
            createSubcategoriesRole = await createRole(
                'Create Subcategories',
                org1,
                {
                    permissions: [PermissionName.create_subjects_20227],
                }
            ).save()

            // Assigning userWithPermission to org1 with the createSubcategoriesRole
            await createOrganizationMembership({
                user: userWithPermission,
                organization: org1,
                roles: [createSubcategoriesRole],
            }).save()

            // Assigning userWithoutPermission to org1
            await createOrganizationMembership({
                user: userWithoutPermission,
                organization: org1,
            }).save()
        })

        context('when user is admin', () => {
            it('should create subcategories in any organization', async () => {
                const input = [
                    ...generateInput(1, org1),
                    ...generateInput(1, org2),
                ]
                const { subcategories } = await createSubcategoriesFromResolver(
                    admin,
                    input
                )
                expect(subcategories.length).to.eq(input.length)

                const inputNames = input.map((i) => i.name)
                const subcategoriesCreatedNames = subcategories.map(
                    (cc: SubcategoryConnectionNode) => cc.name
                )
                expect(subcategoriesCreatedNames).to.deep.equalInAnyOrder(
                    inputNames
                )

                const subcategoriesDB = await findSubcategoriesByInput(input)
                subcategoriesDB.forEach(async (cdb, i) => {
                    expect(cdb.name).to.include(input[i].name)
                    expect(cdb.organizationId).to.eq(input[i].organizationId)
                })
            })
        })

        context('when user is not admin but has permission', () => {
            it('should create subcategories in the organization which belongs', async () => {
                const input = generateInput(2, org1)
                const result = await createSubcategoriesFromResolver(
                    userWithPermission,
                    input
                )
                const { subcategories } = result
                expect(subcategories.length).to.eq(input.length)

                const inputNames = input.map((i) => i.name)
                const subcategoriesCreatedNames = subcategories.map(
                    (cc: SubcategoryConnectionNode) => cc.name
                )
                expect(subcategoriesCreatedNames).to.deep.equalInAnyOrder(
                    inputNames
                )

                const subcategoriesDB = await findSubcategoriesByInput(input)
                subcategoriesDB.forEach(async (cdb, i) => {
                    expect(cdb.name).to.include(input[i].name)
                    expect(cdb.organizationId).to.eq(input[i].organizationId)
                })
            })
        })

        context('error handling', () => {
            context(
                'when non admin tries to create subcategories in an organization which does not belong',
                () => {
                    it('throws a permission error', async () => {
                        const result = createSubcategoriesFromResolver(
                            userWithPermission,
                            generateInput(2, org2)
                        )

                        await expect(result).to.be.rejectedWith(
                            getPermErrorMessage(userWithPermission, [org2])
                        )
                    })
                }
            )

            context(
                'when a user without permission tries to create subcategories in the organization which belongs',
                () => {
                    it('throws a permission error', async () => {
                        const result = createSubcategoriesFromResolver(
                            userWithoutPermission,
                            generateInput(2, org1)
                        )

                        await expect(result).to.be.rejectedWith(
                            getPermErrorMessage(userWithoutPermission, [org1])
                        )
                    })
                }
            )

            context(
                'when non member tries to create categories in any organization',
                () => {
                    it('throws a permission error', async () => {
                        let result = createSubcategoriesFromResolver(
                            userWithoutMembership,
                            generateInput(2, org1)
                        )

                        await expect(result).to.be.rejectedWith(
                            getPermErrorMessage(userWithoutMembership, [org1])
                        )

                        result = createSubcategoriesFromResolver(
                            userWithoutMembership,
                            generateInput(2, org2)
                        )

                        await expect(result).to.be.rejectedWith(
                            getPermErrorMessage(userWithoutMembership, [org2])
                        )
                    })
                }
            )

            context('when user sends an empty array as input', () => {
                it('throws an error', async () => {
                    const size = 0
                    const result = createSubcategoriesFromResolver(
                        admin,
                        generateInput(size, org1)
                    )

                    await expect(result).to.be.rejectedWith(
                        `Subcategory input array must not be less than 1 elements.`
                    )
                })
            })

            context(
                'when user tries to create more than 50 subcategories',
                () => {
                    it('throws an error', async () => {
                        const size =
                            config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                        const result = createSubcategoriesFromResolver(
                            admin,
                            generateInput(size, org1)
                        )

                        await expect(result).to.be.rejectedWith(
                            `Subcategory input array must not be greater than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE} elements.`
                        )
                    })
                }
            )

            context(
                'when user tries to create subcategories in an organization which does not exist',
                () => {
                    it('throws an error', async () => {
                        const input = Array.from(Array(2), (_, i) => {
                            return {
                                name: `Category ${i + 1}`,
                                organizationId: NIL_UUID,
                            }
                        })

                        const result = createSubcategoriesFromResolver(
                            admin,
                            input
                        )

                        await expect(result).to.be.rejectedWith(
                            "Cannot read properties of undefined (reading 'organization_id')"
                        )
                    })
                }
            )

            context('when the subcategories to create are duplicated', () => {
                it('throws an error', async () => {
                    const input = [
                        ...generateInput(1, org1),
                        ...generateInput(1, org1),
                    ]

                    const result = createSubcategoriesFromResolver(admin, input)
                    const response = (await expect(result).to.be
                        .rejected) as APIErrorCollection

                    const errors = response.errors
                    expect(errors.length).to.eq(1)
                    expect(errors[0].message).to.be.eq(
                        'On index 1, CreateSubcategoryInput organizationId and name combination must contain unique values.'
                    )
                })
            })

            context('when the subcategory to create already exists', () => {
                let input: CreateSubcategoryInput[]

                beforeEach(async () => {
                    input = generateInput(1, org1)
                    await createSubcategoriesFromResolver(admin, input)
                })

                it('throws an error', async () => {
                    const result = createSubcategoriesFromResolver(admin, input)

                    const response = (await expect(result).to.be
                        .rejected) as APIErrorCollection

                    const subcategoryName = input[0].name
                    const subcategoryOrganization = await Organization.findOne(
                        input[0].organizationId
                    )
                    const organizationName =
                        subcategoryOrganization?.organization_name
                    const errors = response.errors
                    expect(errors.length).to.eq(1)
                    expect(errors[0].message).to.be.eq(
                        `On index 0, Subcategory ${subcategoryName} already exists for Organization ${organizationName}.`
                    )
                })
            })
        })
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

        const expectPermissionError = async (
            user: User,
            subcategoriesToUpdate: Subcategory[],
            expectedOrgs?: Organization[]
        ) => {
            const errorMessage = buildPermissionError(
                PermissionName.edit_subjects_20337,
                user,
                expectedOrgs
            )
            const input = buildUpdateSubcategoryInputArray(
                subcategoriesToUpdate.map((c) => c.id)
            )
            const operation = updateSubcategoriesFromResolver(user, input)
            await expect(operation).to.be.rejectedWith(errorMessage)
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
                        it('should throw a permission error', async () => {
                            const subcatsToUpdate = systemSubcategories
                            await expectPermissionError(
                                userWithPermission,
                                subcatsToUpdate
                            )
                            await expectNoChangesMade(subcatsToUpdate)
                        })
                    })

                    context(
                        'and tries to update subcategories in a non belonging organization',
                        () => {
                            it('should throw a permission error', async () => {
                                const subcatsToUpdate = subcategoriesOrg2
                                await expectPermissionError(
                                    userWithPermission,
                                    subcatsToUpdate
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
                                it('should throw a permission error', async () => {
                                    const subcatsToUpdate = subcategoriesOrg1
                                    await expectPermissionError(
                                        userWithoutPermission,
                                        subcatsToUpdate
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
                                await expectPermissionError(
                                    userWithoutMembership,
                                    subcatsToUpdate
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
                    `when input length is greather than ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE}`,
                    () => {
                        it('should throw an APIError', async () => {
                            const subcategoryToUpdate = subcategoriesOrg1[0]
                            const catsToUpdate = Array.from(
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
