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
import { createSubcategory } from '../../factories/subcategory.factory'
import { TestConnection } from '../../utils/testConnection'
import { deleteSubcategory } from '../../utils/operations/subcategoryOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { Model } from '../../../src/model'
import { Organization } from '../../../src/entities/organization'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Subcategory } from '../../../src/entities/subcategory'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'

use(chaiAsPromised)

describe('Subcategory', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    describe('delete', () => {
        let user: User
        let org: Organization
        let subcategory: Subcategory
        let organizationId: string
        let userId: string

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            userId = user.user_id
            org = createOrganization()
            await connection.manager.save(org)
            organizationId = org.organization_id
            subcategory = createSubcategory(org)
            await connection.manager.save(subcategory)
        })

        context('when user is logged in', () => {
            let otherUserId: string
            let otherUserToken: string
            let roleId: string

            context('and the user is not an admin', () => {
                beforeEach(async () => {
                    const otherUser = await createNonAdminUser(testClient)
                    otherUserId = otherUser.user_id
                    otherUserToken = getNonAdminAuthToken()
                })

                context(
                    'and does not belong to the organization from the subcategory',
                    () => {
                        it('cannot find the subcategory', async () => {
                            const gqlBool = await deleteSubcategory(
                                testClient,
                                subcategory.id,
                                { authorization: otherUserToken }
                            )

                            expect(gqlBool).to.be.undefined
                        })
                    }
                )

                context(
                    'and belongs to the organization from the subcategory',
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

                        context('with a non system subcategory', () => {
                            context(
                                'and has delete subcategory permissions',
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

                                    it('deletes the expected subcategory', async () => {
                                        let dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )

                                        expect(dbSubcategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).to.be
                                            .null

                                        const gqlBool = await deleteSubcategory(
                                            testClient,
                                            subcategory.id,
                                            {
                                                authorization: getNonAdminAuthToken(),
                                            }
                                        )

                                        expect(gqlBool).to.be.true
                                        dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )
                                        expect(dbSubcategory.status).to.eq(
                                            Status.INACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).not.to
                                            .be.null
                                    })

                                    context(
                                        'with the subcategory already deleted',
                                        () => {
                                            beforeEach(async () => {
                                                await deleteSubcategory(
                                                    testClient,
                                                    subcategory.id,
                                                    {
                                                        authorization: getAdminAuthToken(),
                                                    }
                                                )
                                            })

                                            it('cannot delete the subcategory', async () => {
                                                const gqlBool = await deleteSubcategory(
                                                    testClient,
                                                    subcategory.id,
                                                    {
                                                        authorization: getNonAdminAuthToken(),
                                                    }
                                                )

                                                expect(gqlBool).to.be.false
                                                const dbSubcategory = await Subcategory.findOneByOrFail(
                                                    { id: subcategory.id }
                                                )
                                                expect(
                                                    dbSubcategory.status
                                                ).to.eq(Status.INACTIVE)
                                                expect(dbSubcategory.deleted_at)
                                                    .not.to.be.null
                                            })
                                        }
                                    )
                                }
                            )

                            context(
                                'and does not have delete subcategory permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        await expect(
                                            deleteSubcategory(
                                                testClient,
                                                subcategory.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        ).to.be.rejected
                                        const dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )
                                        expect(dbSubcategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).to.be
                                            .null
                                    })
                                }
                            )
                        })

                        context('with a system subcategory', () => {
                            beforeEach(async () => {
                                subcategory.system = true
                                await connection.manager.save(subcategory)
                            })

                            context(
                                'and has delete subcategory permissions',
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
                                            deleteSubcategory(
                                                testClient,
                                                subcategory.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        ).to.be.rejected
                                        const dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )
                                        expect(dbSubcategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).to.be
                                            .null
                                    })
                                }
                            )

                            context(
                                'and does not have delete subcategory permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        await expect(
                                            deleteSubcategory(
                                                testClient,
                                                subcategory.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        ).to.be.rejected
                                        const dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )
                                        expect(dbSubcategory.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).to.be
                                            .null
                                    })
                                }
                            )
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and does not belong to the organization from the subcategory',
                    () => {
                        it('deletes the expected subcategory', async () => {
                            let dbSubcategory = await Subcategory.findOneByOrFail(
                                { id: subcategory.id }
                            )

                            expect(dbSubcategory.status).to.eq(Status.ACTIVE)
                            expect(dbSubcategory.deleted_at).to.be.null

                            const gqlBool = await deleteSubcategory(
                                testClient,
                                subcategory.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.true
                            dbSubcategory = await Subcategory.findOneByOrFail({
                                id: subcategory.id,
                            })
                            expect(dbSubcategory.status).to.eq(Status.INACTIVE)
                            expect(dbSubcategory.deleted_at).not.to.be.null
                        })
                    }
                )

                context(
                    'and belongs to the organization from the subcategory',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                userId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system subcategory', () => {
                            it('deletes the expected subcategory', async () => {
                                let dbSubcategory = await Subcategory.findOneByOrFail(
                                    { id: subcategory.id }
                                )

                                expect(dbSubcategory.status).to.eq(
                                    Status.ACTIVE
                                )
                                expect(dbSubcategory.deleted_at).to.be.null

                                const gqlBool = await deleteSubcategory(
                                    testClient,
                                    subcategory.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbSubcategory = await Subcategory.findOneByOrFail(
                                    { id: subcategory.id }
                                )
                                expect(dbSubcategory.status).to.eq(
                                    Status.INACTIVE
                                )
                                expect(dbSubcategory.deleted_at).not.to.be.null
                            })

                            context(
                                'with the subcategory already deleted',
                                () => {
                                    beforeEach(async () => {
                                        await deleteSubcategory(
                                            testClient,
                                            subcategory.id,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    })

                                    it('cannot delete the subcategory', async () => {
                                        const gqlBool = await deleteSubcategory(
                                            testClient,
                                            subcategory.id,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )

                                        expect(gqlBool).to.be.false
                                        const dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )
                                        expect(dbSubcategory.status).to.eq(
                                            Status.INACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).not.to
                                            .be.null
                                    })
                                }
                            )
                        })

                        context('with a system subcategory', () => {
                            beforeEach(async () => {
                                subcategory.system = true
                                await connection.manager.save(subcategory)
                            })

                            it('deletes the expected subcategory', async () => {
                                let dbSubcategory = await Subcategory.findOneByOrFail(
                                    { id: subcategory.id }
                                )

                                expect(dbSubcategory.status).to.eq(
                                    Status.ACTIVE
                                )
                                expect(dbSubcategory.deleted_at).to.be.null

                                const gqlBool = await deleteSubcategory(
                                    testClient,
                                    subcategory.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbSubcategory = await Subcategory.findOneByOrFail(
                                    { id: subcategory.id }
                                )
                                expect(dbSubcategory.status).to.eq(
                                    Status.INACTIVE
                                )
                                expect(dbSubcategory.deleted_at).not.to.be.null
                            })

                            context(
                                'with the subcategory already deleted',
                                () => {
                                    beforeEach(async () => {
                                        await deleteSubcategory(
                                            testClient,
                                            subcategory.id,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    })

                                    it('cannot delete the subcategory', async () => {
                                        const gqlBool = await deleteSubcategory(
                                            testClient,
                                            subcategory.id,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )

                                        expect(gqlBool).to.be.false
                                        const dbSubcategory = await Subcategory.findOneByOrFail(
                                            { id: subcategory.id }
                                        )
                                        expect(dbSubcategory.status).to.eq(
                                            Status.INACTIVE
                                        )
                                        expect(dbSubcategory.deleted_at).not.to
                                            .be.null
                                    })
                                }
                            )
                        })
                    }
                )
            })
        })
    })
})
