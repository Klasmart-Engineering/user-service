import { expect, use } from 'chai'
import { Connection } from 'typeorm'
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
import { Category } from '../../../src/entities/category'
import { createCategory } from '../../factories/category.factory'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { createOrganization } from '../../factories/organization.factory'
import { createSubcategory } from '../../factories/subcategory.factory'
import { createSubject } from '../../factories/subject.factory'
import { createTestConnection } from '../../utils/testConnection'
import {
    deleteSubject,
    describeSubject,
} from '../../utils/operations/subjectOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { Model } from '../../../src/model'
import { Role } from '../../../src/entities/role'
import { Organization } from '../../../src/entities/organization'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Subcategory } from '../../../src/entities/subcategory'
import { Subject } from '../../../src/entities/subject'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'

use(chaiAsPromised)

describe('Subject', () => {
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

    describe('subject', () => {
        let user: User
        let organization: Organization
        let category: Category
        let subcategory: Subcategory
        let subject: Subject

        const categoryInfo = (category: any) => {
            return category.id
        }

        const subjectInfo = async (subject: any) => {
            return {
                name: subject.name,
                categories: ((await subject.categories) || []).map(
                    categoryInfo
                ),
                subcategories: ((await subject.subcategories) || []).map(
                    categoryInfo
                ),
                system: subject.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = createOrganization({})
            await organization.save()
            subcategory = createSubcategory(organization)
            await subcategory.save()
            category = createCategory(organization, [subcategory])
            await category.save()
            subject = createSubject(organization, [category])
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await subject.save()
        })

        context('when not authenticated', () => {
            it('fails to list subjects in the organization', async () => {
                const fn = () =>
                    describeSubject(testClient, subject.id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view subject permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('fails to list subjects in the organization', async () => {
                        const fn = () =>
                            describeSubject(testClient, subject.id, {
                                authorization: getNonAdminAuthToken(),
                            })

                        expect(fn()).to.be.rejected
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_subjects_20115,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the subjects in the organization', async () => {
                    const subjectDetails = {
                        name: subject.name,
                        categories: [category.id],
                        subcategories: [subcategory.id],
                        system: subject.system,
                    }
                    const gqlSubject = await describeSubject(
                        testClient,
                        subject.id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    const gqlSubjectDetails = await subjectInfo(gqlSubject)
                    expect(subjectDetails).to.deep.eq(gqlSubjectDetails)
                })
            })
        })
    })

    describe('delete', () => {
        let user: User
        let org: Organization
        let subject: Subject
        let organizationId: string
        let userId: string

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            userId = user.user_id
            org = createOrganization({})
            await connection.manager.save(org)
            organizationId = org.organization_id
            subject = createSubject(org)
            await connection.manager.save(subject)
        })

        context('when user is not logged in', () => {
            it('cannot find the subject', async () => {
                const gqlBool = await deleteSubject(testClient, subject.id, {
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
                    'and does not belong to the organization from the subject',
                    () => {
                        it('cannot find the subject', async () => {
                            const gqlBool = await deleteSubject(
                                testClient,
                                subject.id,
                                { authorization: undefined }
                            )

                            expect(gqlBool).to.be.undefined
                        })
                    }
                )

                context(
                    'and belongs to the organization from the subject',
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

                        context('with a non system subject', () => {
                            context(
                                'and has delete subject permissions',
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

                                    it('deletes the expected subject', async () => {
                                        let dbSubject = await Subject.findOneOrFail(
                                            subject.id
                                        )

                                        expect(dbSubject.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubject.deleted_at).to.be.null

                                        const gqlBool = await deleteSubject(
                                            testClient,
                                            subject.id,
                                            {
                                                authorization: getNonAdminAuthToken(),
                                            }
                                        )

                                        expect(gqlBool).to.be.true
                                        dbSubject = await Subject.findOneOrFail(
                                            subject.id
                                        )
                                        expect(dbSubject.status).to.eq(
                                            Status.INACTIVE
                                        )
                                        expect(dbSubject.deleted_at).not.to.be
                                            .null
                                    })

                                    context(
                                        'with the subject already deleted',
                                        () => {
                                            beforeEach(async () => {
                                                await deleteSubject(
                                                    testClient,
                                                    subject.id,
                                                    {
                                                        authorization: getAdminAuthToken(),
                                                    }
                                                )
                                            })

                                            it('cannot delete the subject', async () => {
                                                const gqlBool = await deleteSubject(
                                                    testClient,
                                                    subject.id,
                                                    {
                                                        authorization: getNonAdminAuthToken(),
                                                    }
                                                )

                                                expect(gqlBool).to.be.false
                                                const dbSubject = await Subject.findOneOrFail(
                                                    subject.id
                                                )
                                                expect(dbSubject.status).to.eq(
                                                    Status.INACTIVE
                                                )
                                                expect(dbSubject.deleted_at).not
                                                    .to.be.null
                                            })
                                        }
                                    )
                                }
                            )

                            context(
                                'and does not have delete subject permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteSubject(
                                                testClient,
                                                subject.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        expect(fn()).to.be.rejected
                                        const dbSubject = await Subject.findOneOrFail(
                                            subject.id
                                        )
                                        expect(dbSubject.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubject.deleted_at).to.be.null
                                    })
                                }
                            )
                        })

                        context('with a system subject', () => {
                            beforeEach(async () => {
                                subject.system = true
                                await connection.manager.save(subject)
                            })

                            context(
                                'and has delete subject permissions',
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
                                        const fn = () =>
                                            deleteSubject(
                                                testClient,
                                                subject.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        expect(fn()).to.be.rejected
                                        const dbSubject = await Subject.findOneOrFail(
                                            subject.id
                                        )
                                        expect(dbSubject.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubject.deleted_at).to.be.null
                                    })
                                }
                            )

                            context(
                                'and does not have delete subject permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteSubject(
                                                testClient,
                                                subject.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )
                                        expect(fn()).to.be.rejected
                                        const dbSubject = await Subject.findOneOrFail(
                                            subject.id
                                        )
                                        expect(dbSubject.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbSubject.deleted_at).to.be.null
                                    })
                                }
                            )
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and does not belong to the organization from the subject',
                    () => {
                        it('deletes the expected subject', async () => {
                            let dbSubject = await Subject.findOneOrFail(
                                subject.id
                            )

                            expect(dbSubject.status).to.eq(Status.ACTIVE)
                            expect(dbSubject.deleted_at).to.be.null

                            const gqlBool = await deleteSubject(
                                testClient,
                                subject.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.true
                            dbSubject = await Subject.findOneOrFail(subject.id)
                            expect(dbSubject.status).to.eq(Status.INACTIVE)
                            expect(dbSubject.deleted_at).not.to.be.null
                        })
                    }
                )

                context(
                    'and belongs to the organization from the subject',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                userId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system subject', () => {
                            it('deletes the expected subject', async () => {
                                let dbSubject = await Subject.findOneOrFail(
                                    subject.id
                                )

                                expect(dbSubject.status).to.eq(Status.ACTIVE)
                                expect(dbSubject.deleted_at).to.be.null

                                const gqlBool = await deleteSubject(
                                    testClient,
                                    subject.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbSubject = await Subject.findOneOrFail(
                                    subject.id
                                )
                                expect(dbSubject.status).to.eq(Status.INACTIVE)
                                expect(dbSubject.deleted_at).not.to.be.null
                            })

                            context('with the subject already deleted', () => {
                                beforeEach(async () => {
                                    await deleteSubject(
                                        testClient,
                                        subject.id,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('cannot delete the subject', async () => {
                                    const gqlBool = await deleteSubject(
                                        testClient,
                                        subject.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbSubject = await Subject.findOneOrFail(
                                        subject.id
                                    )
                                    expect(dbSubject.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbSubject.deleted_at).not.to.be.null
                                })
                            })
                        })

                        context('with a system subject', () => {
                            beforeEach(async () => {
                                subject.system = true
                                await connection.manager.save(subject)
                            })

                            it('deletes the expected subject', async () => {
                                let dbSubject = await Subject.findOneOrFail(
                                    subject.id
                                )

                                expect(dbSubject.status).to.eq(Status.ACTIVE)
                                expect(dbSubject.deleted_at).to.be.null

                                const gqlBool = await deleteSubject(
                                    testClient,
                                    subject.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbSubject = await Subject.findOneOrFail(
                                    subject.id
                                )
                                expect(dbSubject.status).to.eq(Status.INACTIVE)
                                expect(dbSubject.deleted_at).not.to.be.null
                            })

                            context('with the subject already deleted', () => {
                                beforeEach(async () => {
                                    await deleteSubject(
                                        testClient,
                                        subject.id,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('cannot delete the subject', async () => {
                                    const gqlBool = await deleteSubject(
                                        testClient,
                                        subject.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbSubject = await Subject.findOneOrFail(
                                        subject.id
                                    )
                                    expect(dbSubject.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbSubject.deleted_at).not.to.be.null
                                })
                            })
                        })
                    }
                )
            })
        })
    })
})
