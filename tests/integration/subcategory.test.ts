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
import { deleteSubcategories } from '../../src/resolvers/subcategory'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    DeleteSubcategoryInput,
    SubcategoriesMutationResult,
} from '../../src/types/graphQL/subcategory'
import { userToPayload } from '../utils/operations/userOps'
import { Context } from '../../src/main'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'

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

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('delete subcategories', () => {
        let admin: User
        let userWithPermission: User
        let userWithoutPermission: User
        let userWithoutMembership: User
        let org1: Organization
        let org2: Organization
        let deleteSubcategoriesRoleOrg1: Role
        let subcategoriesOrg1: Subcategory[]
        let subcategoriesOrg2: Subcategory[]
        let systemSubcategories: Subcategory[]
        const orgsPerType = 5

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
                'Create Categories',
                org1,
                {
                    permissions: [PermissionName.delete_subjects_20447],
                }
            ).save()

            // Assigning userWithPermission to org1 with the createCategoriesRole
            await createOrganizationMembership({
                user: userWithPermission,
                organization: org1,
                roles: [deleteSubcategoriesRoleOrg1],
            }).save()

            // Assigning userWithoutPermission to org1
            await createOrganizationMembership({
                user: userWithoutPermission,
                organization: org1,
            }).save()
        })

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

            context('deleting a category from an organization', () => {
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
})
