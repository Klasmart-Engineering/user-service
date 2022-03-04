import { expect } from 'chai'
import { SelectQueryBuilder, getConnection } from 'typeorm'
import { createEntityScope } from '../../../src/directives/isAdmin'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Role } from '../../../src/entities/role'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { organizationMembershipConnectionQuery } from '../../../src/pagination/organizationMembershipsConnection'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import {
    loadOrganizationMembershipsForOrganization,
    organizationMembershipsConnectionResolver as resolverForOrg,
} from '../../../src/schemas/organization'
import {
    loadOrganizationMembershipsForUser,
    organizationMembershipsConnectionResolver as resolverForUser,
} from '../../../src/schemas/user'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'

describe('organizationMembershipsConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    let org1: Organization
    let org2: Organization
    let org1Memberships: OrganizationMembership[]
    let org2Memberships: OrganizationMembership[]
    let org1Role: Role
    let org2Role: Role

    let adminScope: SelectQueryBuilder<OrganizationMembership>
    let nonAdminScope: SelectQueryBuilder<OrganizationMembership>

    beforeEach(async () => {
        org1 = await createOrganization().save()
        org2 = await createOrganization().save()
        org1Role = await createRole().save()
        org2Role = await createRole().save()
        org1Memberships = await Promise.all([
            createOrganizationMembership({
                organization: org1,
                user: await createUser().save(),
                roles: [org1Role],
                status: Status.ACTIVE,
            }).save(),
            createOrganizationMembership({
                organization: org1,
                user: await createUser().save(),
                roles: [org1Role],
                status: Status.ACTIVE,
            }).save(),
        ])
        org2Memberships = await Promise.all([
            createOrganizationMembership({
                organization: org2,
                user: await createUser().save(),
                roles: [org2Role],
                status: Status.INACTIVE,
            }).save(),
            createOrganizationMembership({
                organization: org2,
                user: await createUser().save(),
                roles: [org2Role],
                status: Status.INACTIVE,
            }).save(),
        ])

        const admin = await createAdminUser(testClient)
        const nonAdmin = await createNonAdminUser(testClient)

        adminScope = (await createEntityScope({
            permissions: new UserPermissions({
                id: admin.user_id,
                email: admin.email!,
            }),
            entity: 'organizationMembership',
        })) as SelectQueryBuilder<OrganizationMembership>
        nonAdminScope = (await createEntityScope({
            permissions: new UserPermissions({
                id: nonAdmin.user_id,
                email: nonAdmin.email!,
            }),
            entity: 'organizationMembership',
        })) as SelectQueryBuilder<OrganizationMembership>
    })

    describe('organizationMembershipConnectionQuery()', () => {
        context('filtering', () => {
            async function runQuery(filter: IEntityFilter) {
                const newScope = await organizationMembershipConnectionQuery(
                    adminScope,
                    filter
                )
                return newScope.getMany()
            }

            it('filters by userId', async () => {
                const data = await runQuery({
                    userId: {
                        operator: 'eq',
                        value: org1Memberships[0].user_id,
                    },
                })
                expect(data).to.have.lengthOf(1)
            })
            it('filters by organizationId', async () => {
                const data = await runQuery({
                    organizationId: {
                        operator: 'eq',
                        value: org1.organization_id,
                    },
                })
                expect(data).to.have.lengthOf(org1Memberships.length)
            })
            it('filters by shortCode', async () => {
                const data = await runQuery({
                    shortCode: {
                        operator: 'eq',
                        value: org1Memberships[0].shortcode,
                    },
                })
                expect(data).to.have.lengthOf(1)
            })
            it('filters by roleId', async () => {
                const data = await runQuery({
                    roleId: {
                        operator: 'eq',
                        value: org1Role.role_id,
                    },
                })
                expect(data).to.have.lengthOf(org1Memberships.length)
            })
            it('filters by status', async () => {
                const members = await runQuery({
                    status: {
                        operator: 'eq',
                        value: 'active',
                    },
                })
                expect(members).to.have.lengthOf(org1Memberships.length)
            })
        })
    })
    describe('organizationMembershipsConnectionChild', () => {
        let clientUser: User
        let ctx: Pick<Context, 'loaders'>
        let fakeInfo: any

        beforeEach(async () => {
            clientUser = await createUser().save()

            // add the client user to both orgs
            org1Memberships.push(
                await createOrganizationMembership({
                    user: clientUser,
                    organization: org1,
                    roles: [org1Role],
                }).save()
            )
            org2Memberships.push(
                await createOrganizationMembership({
                    user: clientUser,
                    organization: org2,
                    roles: [org2Role],
                }).save()
            )

            const token = { id: clientUser.user_id }
            const permissions = new UserPermissions(token)
            ctx = { loaders: createContextLazyLoaders(permissions) }
            fakeInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'organizationMembershipsConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        context('as child of a user', () => {
            it('returns memberships per user', async () => {
                const result = await loadOrganizationMembershipsForUser(
                    ctx,
                    clientUser.user_id
                )
                expect(result.edges).to.have.lengthOf(2)
                expect(
                    result.edges.map((e) => e.node.organizationId)
                ).to.have.same.members([
                    org1.organization_id,
                    org2.organization_id,
                ])
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForUser(
                    { id: clientUser.user_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(2)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForUser(
                    { id: clientUser.user_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        context('as child of an org', () => {
            it('returns memberships per org', async () => {
                const result = await loadOrganizationMembershipsForOrganization(
                    ctx,
                    org1.organization_id
                )
                expect(result.edges).to.have.lengthOf(org1Memberships.length)
                expect(
                    result.edges.map((e) => e.node.userId)
                ).to.have.same.members(org1Memberships.map((m) => m.user_id))
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForOrg(
                    { id: org1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(org1Memberships.length)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForOrg(
                    { id: org1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        it('uses exactly one dataloader when called with different parent', async () => {
            const otherUser = await createUser().save()
            await createOrganizationMembership({
                user: otherUser,
                organization: org1,
                roles: [org1Role],
            }).save()

            connection.logger.reset()
            const loaderResults = []
            for (const user of [clientUser, otherUser]) {
                loaderResults.push(
                    loadOrganizationMembershipsForUser(
                        ctx,
                        user.user_id,
                        {},
                        false
                    )
                )
            }
            await Promise.all(loaderResults)
            // one for permissions query
            // one for fetching memberships
            expect(connection.logger.count).to.be.eq(2)
        })
        context('sorting', () => {
            it('sorts by userId', async () => {
                const result = await loadOrganizationMembershipsForOrganization(
                    ctx,
                    org1.organization_id,
                    {
                        sort: {
                            field: 'userId',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = org1Memberships.map((m) => m.user_id).sort()
                expect(result.edges.map((e) => e.node.userId)).to.deep.equal(
                    sorted
                )
            })
            it('sorts by organizationId', async () => {
                const result = await loadOrganizationMembershipsForUser(
                    ctx,
                    clientUser.user_id,
                    {
                        sort: {
                            field: 'organizationId',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = [
                    org1.organization_id,
                    org2.organization_id,
                ].sort()
                expect(
                    result.edges.map((e) => e.node.organizationId)
                ).to.deep.equal(sorted)
            })
        })
        context('totalCount', () => {
            it('returns total count', async () => {
                const result = await loadOrganizationMembershipsForUser(
                    ctx,
                    clientUser.user_id,
                    {},
                    true
                )
                expect(result.totalCount).to.eq(2)
            })
            it('does not return total count', async () => {
                const result = await loadOrganizationMembershipsForUser(
                    ctx,
                    clientUser.user_id,
                    {},
                    false
                )
                expect(result.totalCount).to.not.exist
            })
        })
    })
})
