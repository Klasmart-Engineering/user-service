import { Organization } from '../../../src/entities/organization'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createOrganization } from '../../factories/organization.factory'
import { createUser } from '../../factories/user.factory'
import { User } from '../../../src/entities/user'
import { expect } from 'chai'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { Role } from '../../../src/entities/role'
import { createRole } from '../../factories/role.factory'
import {
    organizationsChildConnection,
    organizationsChildConnectionResolver,
} from '../../../src/schemas/user'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { Context } from '../../../src/main'
import { GraphQLResolveInfo } from 'graphql'

describe('organizationsChildConnection', async () => {
    let connection: TestConnection
    let ctx: Pick<Context, 'loaders'>

    let role: Role
    let clientUser: User
    let otherUser: User
    let bothUsersOrg: Organization
    let clientUsersOrg: Organization
    let otherUsersOrg: Organization

    let memberships: Map<User, Organization[]>

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        role = await createRole().save()

        bothUsersOrg = await createOrganization().save()
        clientUsersOrg = await createOrganization().save()
        otherUsersOrg = await createOrganization().save()

        clientUser = await createUser().save()
        otherUser = await createUser().save()

        memberships = new Map([
            [clientUser, [bothUsersOrg, clientUsersOrg]],
            [otherUser, [bothUsersOrg, otherUsersOrg]],
        ])

        for (const [user, organizations] of memberships) {
            for (const organization of organizations) {
                await createOrganizationMembership({
                    user,
                    organization,
                    roles: [role],
                }).save()
            }
        }

        const token = { id: clientUser.user_id }
        const permissions = new UserPermissions(token)
        ctx = { loaders: createContextLazyLoaders(permissions) }
    })

    it('returns correct orgs per user', async () => {
        const args: IChildPaginationArgs = {
            direction: 'FORWARD',
            count: 2,
        }

        const result = await organizationsChildConnection(
            { id: clientUser.user_id },
            args,
            ctx.loaders,
            false
        )

        expect(result.edges.map((e) => e.node.id)).to.have.same.members(
            memberships.get(clientUser)!.map((org) => org.organization_id)
        )
    })

    it('uses exactly one dataloader when called with different users', async () => {
        connection.logger.reset()

        const loaderResults = []
        for (const user of [clientUser, otherUser]) {
            const loaderResult = organizationsChildConnection(
                { id: user.user_id },
                {},
                ctx.loaders,
                false
            )
            loaderResults.push(loaderResult)
        }

        await Promise.all(loaderResults)
        // one for permissions query
        // one for fetching organizations
        expect(connection.logger.count).to.be.eq(2)
    })

    context('sorting', () => {
        it('sorts by name', async () => {
            const args: IChildPaginationArgs = {
                direction: 'FORWARD',
                count: 2,
                sort: {
                    field: 'name',
                    order: 'ASC',
                },
            }

            const result = await organizationsChildConnection(
                { id: clientUser.user_id },
                args,
                ctx.loaders,
                false
            )

            const sorted = memberships
                .get(clientUser)!
                .map((org) => org.organization_name)
                .sort()

            expect(result.edges.map((e) => e.node.name)).deep.equal(sorted)
        })
    })

    context('totalCount', async () => {
        let fakeInfo: any

        beforeEach(() => {
            fakeInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'organizationsConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        const callResolver = (
            fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
        ) => {
            return organizationsChildConnectionResolver(
                { id: clientUser.user_id },
                {},
                ctx,
                fakeInfo
            )
        }

        it('returns total count', async () => {
            fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                kind: 'Field',
                name: { kind: 'Name', value: 'totalCount' },
            })

            const result = await callResolver(fakeInfo)
            expect(result.totalCount).to.eq(memberships.get(clientUser)!.length)
        })

        it('doesnt return total count', async () => {
            const result = await callResolver(fakeInfo)
            expect(result.totalCount).to.eq(undefined)
        })
    })
})
