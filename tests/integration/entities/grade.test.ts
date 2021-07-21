import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import chaiAsPromised from 'chai-as-promised'

import { Grade } from '../../../src/entities/grade'
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
import { createGrade } from '../../factories/grade.factory'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { createOrganization } from '../../factories/organization.factory'
import { createTestConnection } from '../../utils/testConnection'
import { deleteGrade } from '../../utils/operations/gradeOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { Model } from '../../../src/model'
import { Role } from '../../../src/entities/role'
import { Organization } from '../../../src/entities/organization'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'

use(chaiAsPromised)

describe('Grade', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('delete', () => {
        let user: User
        let org: Organization
        let grade: Grade
        let organizationId: string
        let userId: string

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            userId = user.user_id
            org = createOrganization()
            await connection.manager.save(org)
            organizationId = org.organization_id
            grade = createGrade(org)
            await connection.manager.save(grade)
        })

        context('when user is not logged in', () => {
            it('cannot find the grade', async () => {
                const gqlBool = await deleteGrade(testClient, grade.id, {
                    authorization: undefined,
                })

                expect(gqlBool).to.be.undefined
            })
        })

        context('when user is logged in', () => {
            let otherUserId: string
            let roleId: string

            context('and the user is not an admin', () => {
                beforeEach(async () => {
                    const otherUser = await createNonAdminUser(testClient)
                    otherUserId = otherUser.user_id
                })

                context(
                    'and does not belong to the organization from the grade',
                    () => {
                        it('cannot find the grade', async () => {
                            const gqlBool = await deleteGrade(
                                testClient,
                                grade.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.undefined
                        })
                    }
                )

                context(
                    'and belongs to the organization from the grade',
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

                        context('with a non system grade', () => {
                            context('and has delete grade permissions', () => {
                                beforeEach(async () => {
                                    await grantPermission(
                                        testClient,
                                        roleId,
                                        PermissionName.delete_grade_20443,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('deletes the expected grade', async () => {
                                    let dbGrade = await Grade.findOneOrFail(
                                        grade.id
                                    )

                                    expect(dbGrade.status).to.eq(Status.ACTIVE)
                                    expect(dbGrade.deleted_at).to.be.null

                                    const gqlBool = await deleteGrade(
                                        testClient,
                                        grade.id,
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                    expect(gqlBool).to.be.true
                                    dbGrade = await Grade.findOneOrFail(
                                        grade.id
                                    )
                                    expect(dbGrade.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbGrade.deleted_at).not.to.be.null
                                })

                                context(
                                    'with the grade already deleted',
                                    () => {
                                        beforeEach(async () => {
                                            await deleteGrade(
                                                testClient,
                                                grade.id,
                                                {
                                                    authorization: getAdminAuthToken(),
                                                }
                                            )
                                        })

                                        it('cannot delete the grade', async () => {
                                            const gqlBool = await deleteGrade(
                                                testClient,
                                                grade.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )

                                            expect(gqlBool).to.be.false
                                            const dbGrade = await Grade.findOneOrFail(
                                                grade.id
                                            )
                                            expect(dbGrade.status).to.eq(
                                                Status.INACTIVE
                                            )
                                            expect(dbGrade.deleted_at).not.to.be
                                                .null
                                        })
                                    }
                                )
                            })

                            context(
                                'and does not have delete grade permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteGrade(testClient, grade.id, {
                                                authorization: getNonAdminAuthToken(),
                                            })
                                        await expect(fn()).to.be.rejected
                                        const dbGrade = await Grade.findOneOrFail(
                                            grade.id
                                        )

                                        expect(dbGrade.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbGrade.deleted_at).to.be.null
                                    })
                                }
                            )
                        })

                        context('with a system grade', () => {
                            beforeEach(async () => {
                                grade.system = true
                                await connection.manager.save(grade)
                            })

                            context('and has delete grade permissions', () => {
                                beforeEach(async () => {
                                    await grantPermission(
                                        testClient,
                                        roleId,
                                        PermissionName.delete_grade_20443,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('raises a permission error', async () => {
                                    const fn = () =>
                                        deleteGrade(testClient, grade.id, {
                                            authorization: getNonAdminAuthToken(),
                                        })
                                    await expect(fn()).to.be.rejected
                                    const dbGrade = await Grade.findOneOrFail(
                                        grade.id
                                    )

                                    expect(dbGrade.status).to.eq(Status.ACTIVE)
                                    expect(dbGrade.deleted_at).to.be.null
                                })
                            })

                            context(
                                'and does not have delete grade permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteGrade(testClient, grade.id, {
                                                authorization: getNonAdminAuthToken(),
                                            })
                                        await expect(fn()).to.be.rejected
                                        const dbGrade = await Grade.findOneOrFail(
                                            grade.id
                                        )

                                        expect(dbGrade.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbGrade.deleted_at).to.be.null
                                    })
                                }
                            )
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and does not belong to the organization from the grade',
                    () => {
                        it('deletes the expected grade', async () => {
                            let dbGrade = await Grade.findOneOrFail(grade.id)

                            expect(dbGrade.status).to.eq(Status.ACTIVE)
                            expect(dbGrade.deleted_at).to.be.null

                            const gqlBool = await deleteGrade(
                                testClient,
                                grade.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.true
                            dbGrade = await Grade.findOneOrFail(grade.id)
                            expect(dbGrade.status).to.eq(Status.INACTIVE)
                            expect(dbGrade.deleted_at).not.to.be.null
                        })
                    }
                )

                context(
                    'and belongs to the organization from the grade',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                userId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system grade', () => {
                            it('deletes the expected grade', async () => {
                                let dbGrade = await Grade.findOneOrFail(
                                    grade.id
                                )

                                expect(dbGrade.status).to.eq(Status.ACTIVE)
                                expect(dbGrade.deleted_at).to.be.null

                                const gqlBool = await deleteGrade(
                                    testClient,
                                    grade.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbGrade = await Grade.findOneOrFail(grade.id)
                                expect(dbGrade.status).to.eq(Status.INACTIVE)
                                expect(dbGrade.deleted_at).not.to.be.null
                            })

                            context('with the grade already deleted', () => {
                                beforeEach(async () => {
                                    await deleteGrade(testClient, grade.id, {
                                        authorization: getAdminAuthToken(),
                                    })
                                })

                                it('cannot delete the grade', async () => {
                                    const gqlBool = await deleteGrade(
                                        testClient,
                                        grade.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbGrade = await Grade.findOneOrFail(
                                        grade.id
                                    )
                                    expect(dbGrade.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbGrade.deleted_at).not.to.be.null
                                })
                            })
                        })

                        context('with a system grade', () => {
                            beforeEach(async () => {
                                grade.system = true
                                await connection.manager.save(grade)
                            })

                            it('deletes the expected grade', async () => {
                                let dbGrade = await Grade.findOneOrFail(
                                    grade.id
                                )

                                expect(dbGrade.status).to.eq(Status.ACTIVE)
                                expect(dbGrade.deleted_at).to.be.null

                                const gqlBool = await deleteGrade(
                                    testClient,
                                    grade.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbGrade = await Grade.findOneOrFail(grade.id)
                                expect(dbGrade.status).to.eq(Status.INACTIVE)
                                expect(dbGrade.deleted_at).not.to.be.null
                            })

                            context('with the grade already deleted', () => {
                                beforeEach(async () => {
                                    await deleteGrade(testClient, grade.id, {
                                        authorization: getAdminAuthToken(),
                                    })
                                })

                                it('cannot delete the grade', async () => {
                                    const gqlBool = await deleteGrade(
                                        testClient,
                                        grade.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbGrade = await Grade.findOneOrFail(
                                        grade.id
                                    )
                                    expect(dbGrade.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbGrade.deleted_at).not.to.be.null
                                })
                            })
                        })
                    }
                )
            })
        })
    })
})
