import { expect, use } from 'chai'
import { getConnection } from 'typeorm'
import chaiAsPromised from 'chai-as-promised'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    addUserToOrganizationAndValidate,
    createRole,
} from '../../utils/operations/organizationOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { getNonAdminAuthToken, getAdminAuthToken } from '../../utils/testConfig'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { createOrganization } from '../../factories/organization.factory'
import { createCategory } from '../../factories/category.factory'
import { createSubcategory } from '../../factories/subcategory.factory'
import { TestConnection } from '../../utils/testConnection'
import {
    deleteCategory,
    editSubcategories,
} from '../../utils/operations/categoryOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { Model } from '../../../src/model'
import { Organization } from '../../../src/entities/organization'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Category } from '../../../src/entities/category'
import { Subcategory } from '../../../src/entities/subcategory'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'

use(chaiAsPromised)

describe('Category', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let user: User
    let org: Organization
    let category: Category
    let organizationId: string
    let userId: string

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        user = await createAdminUser(testClient)
        userId = user.user_id
        org = createOrganization()
        await org.save()
        organizationId = org.organization_id
        category = createCategory(org)
        await category.save()
    })

    describe('delete', () => {
        context('when user is logged in', () => {
            let otherUserId: string
            let roleId: string
            let otherUserToken: string

            context('and the user is not an admin', () => {
                beforeEach(async () => {
                    const otherUser = await createNonAdminUser(testClient)
                    otherUserId = otherUser.user_id
                    otherUserToken = getNonAdminAuthToken()
                })

                context(
                    'and does not belong to the organization from the category',
                    () => {
                        it('cannot find the category', async () => {
                            const gqlBool = await deleteCategory(
                                testClient,
                                category.id,
                                { authorization: otherUserToken }
                            )

                            expect(gqlBool).to.be.undefined
                        })
                    }
                )

                context(
                    'and belongs to the organization from the category',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                otherUserId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                            roleId = (
                                await createRole(
                                    testClient,
                                    organizationId,
                                    'My Role'
                                )
                            ).role_id
                            await addRoleToOrganizationMembership(
                                testClient,
                                otherUserId,
                                organizationId,
                                roleId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system category', () => {
                            context(
                                'and has delete category permissions',
                                () => {
                                    beforeEach(async () => {
                                        await grantPermission(
                                            testClient,
                                            roleId,
                                            PermissionName.delete_subjects_20447,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    })

                                    it('deletes the expected category', async () => {
                                        let dbCategory = await Category.findOneByOrFail(
                                            {
                                                id: category.id,
                                            }
                                        )

                                        expect(dbCategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbCategory.deleted_at).to.be.null

                                        const gqlBool = await deleteCategory(
                                            testClient,
                                            category.id,
                                            {
                                                authorization: getNonAdminAuthToken(),
                                            }
                                        )

                                        expect(gqlBool).to.be.true
                                        dbCategory = await Category.findOneByOrFail(
                                            { id: category.id }
                                        )
                                        expect(dbCategory.status).to.eq(
                                            Status.INACTIVE
                                        )
                                        expect(dbCategory.deleted_at).not.to.be
                                            .null
                                    })

                                    context(
                                        'with the category already deleted',
                                        () => {
                                            beforeEach(async () => {
                                                await deleteCategory(
                                                    testClient,
                                                    category.id,
                                                    {
                                                        authorization: getAdminAuthToken(),
                                                    }
                                                )
                                            })

                                            it('cannot delete the category', async () => {
                                                const gqlBool = await deleteCategory(
                                                    testClient,
                                                    category.id,
                                                    {
                                                        authorization: getNonAdminAuthToken(),
                                                    }
                                                )

                                                expect(gqlBool).to.be.false
                                                const dbCategory = await Category.findOneByOrFail(
                                                    {
                                                        id: category.id,
                                                    }
                                                )
                                                expect(dbCategory.status).to.eq(
                                                    Status.INACTIVE
                                                )
                                                expect(dbCategory.deleted_at)
                                                    .not.to.be.null
                                            })
                                        }
                                    )
                                }
                            )

                            context(
                                'and does not have delete category permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        await expect(
                                            deleteCategory(
                                                testClient,
                                                category.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        ).to.be.rejected
                                        const dbCategory = await Category.findOneByOrFail(
                                            { id: category.id }
                                        )
                                        expect(dbCategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbCategory.deleted_at).to.be.null
                                    })
                                }
                            )
                        })

                        context('with a system category', () => {
                            beforeEach(async () => {
                                category.system = true
                                await connection.manager.save(category)
                            })

                            context(
                                'and has delete category permissions',
                                () => {
                                    beforeEach(async () => {
                                        await grantPermission(
                                            testClient,
                                            roleId,
                                            PermissionName.delete_subjects_20447,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    })

                                    it('raises a permission error', async () => {
                                        await expect(
                                            deleteCategory(
                                                testClient,
                                                category.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        ).to.be.rejected
                                        const dbCategory = await Category.findOneByOrFail(
                                            { id: category.id }
                                        )
                                        expect(dbCategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbCategory.deleted_at).to.be.null
                                    })
                                }
                            )

                            context(
                                'and does not have delete category permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        await expect(
                                            deleteCategory(
                                                testClient,
                                                category.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        ).to.be.rejected
                                        const dbCategory = await Category.findOneByOrFail(
                                            { id: category.id }
                                        )
                                        expect(dbCategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbCategory.deleted_at).to.be.null
                                    })
                                }
                            )
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and does not belong to the organization from the category',
                    () => {
                        it('deletes the expected category', async () => {
                            let dbCategory = await Category.findOneByOrFail({
                                id: category.id,
                            })

                            expect(dbCategory.status).to.eq(Status.ACTIVE)
                            expect(dbCategory.deleted_at).to.be.null

                            const gqlBool = await deleteCategory(
                                testClient,
                                category.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.true
                            dbCategory = await Category.findOneByOrFail({
                                id: category.id,
                            })
                            expect(dbCategory.status).to.eq(Status.INACTIVE)
                            expect(dbCategory.deleted_at).not.to.be.null
                        })
                    }
                )

                context(
                    'and belongs to the organization from the category',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                userId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system category', () => {
                            it('deletes the expected category', async () => {
                                let dbCategory = await Category.findOneByOrFail(
                                    { id: category.id }
                                )

                                expect(dbCategory.status).to.eq(Status.ACTIVE)
                                expect(dbCategory.deleted_at).to.be.null

                                const gqlBool = await deleteCategory(
                                    testClient,
                                    category.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbCategory = await Category.findOneByOrFail({
                                    id: category.id,
                                })
                                expect(dbCategory.status).to.eq(Status.INACTIVE)
                                expect(dbCategory.deleted_at).not.to.be.null
                            })

                            context('with the category already deleted', () => {
                                beforeEach(async () => {
                                    await deleteCategory(
                                        testClient,
                                        category.id,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('cannot delete the category', async () => {
                                    const gqlBool = await deleteCategory(
                                        testClient,
                                        category.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbCategory = await Category.findOneByOrFail(
                                        { id: category.id }
                                    )
                                    expect(dbCategory.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbCategory.deleted_at).not.to.be.null
                                })
                            })
                        })

                        context('with a system category', () => {
                            beforeEach(async () => {
                                category.system = true
                                await connection.manager.save(category)
                            })

                            it('deletes the expected category', async () => {
                                let dbCategory = await Category.findOneByOrFail(
                                    { id: category.id }
                                )

                                expect(dbCategory.status).to.eq(Status.ACTIVE)
                                expect(dbCategory.deleted_at).to.be.null

                                const gqlBool = await deleteCategory(
                                    testClient,
                                    category.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbCategory = await Category.findOneByOrFail({
                                    id: category.id,
                                })
                                expect(dbCategory.status).to.eq(Status.INACTIVE)
                                expect(dbCategory.deleted_at).not.to.be.null
                            })

                            context('with the category already deleted', () => {
                                beforeEach(async () => {
                                    await deleteCategory(
                                        testClient,
                                        category.id,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('cannot delete the category', async () => {
                                    const gqlBool = await deleteCategory(
                                        testClient,
                                        category.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbCategory = await Category.findOneByOrFail(
                                        { id: category.id }
                                    )
                                    expect(dbCategory.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbCategory.deleted_at).not.to.be.null
                                })
                            })
                        })
                    }
                )
            })
        })
    })

    describe('editSubcategories', () => {
        let subcategory: Subcategory
        let otherUserId: string

        const subcategoryInfo = (subcategory: any) => {
            return subcategory.id
        }

        beforeEach(async () => {
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            subcategory = createSubcategory(org)
            await subcategory.save()
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, organizationId)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context(
                'and the user does not have edit category permissions',
                () => {
                    it('throws a permission error', async () => {
                        await expect(
                            editSubcategories(
                                testClient,
                                category.id,
                                [subcategory.id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbSubcategories =
                            (await category.subcategories) || []
                        expect(dbSubcategories).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_subjects_20337,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the category subcategories', async () => {
                    let dbCategory = await Category.findOneByOrFail({
                        id: category.id,
                    })
                    let dbSubcategories = (await dbCategory.subcategories) || []
                    expect(dbSubcategories).to.be.empty

                    let gqlSubcategories = await editSubcategories(
                        testClient,
                        category.id,
                        [subcategory.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbCategory = await Category.findOneByOrFail({
                        id: category.id,
                    })
                    dbSubcategories = (await dbCategory.subcategories) || []
                    expect(dbSubcategories).not.to.be.empty
                    expect(
                        dbSubcategories.map(subcategoryInfo)
                    ).to.deep.equalInAnyOrder(
                        gqlSubcategories.map(subcategoryInfo)
                    )

                    gqlSubcategories = await editSubcategories(
                        testClient,
                        category.id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbCategory = await Category.findOneByOrFail({
                        id: category.id,
                    })
                    dbSubcategories = (await dbCategory.subcategories) || []
                    expect(dbSubcategories).to.be.empty
                })

                context('and the category is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteCategory(testClient, category.id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the category subcategories', async () => {
                        const gqlSubcategories = await editSubcategories(
                            testClient,
                            category.id,
                            [subcategory.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSubcategories).to.be.null

                        const dbSubcategories =
                            (await category.subcategories) || []
                        expect(dbSubcategories).to.be.empty
                    })
                })
            })
        })
    })
})
