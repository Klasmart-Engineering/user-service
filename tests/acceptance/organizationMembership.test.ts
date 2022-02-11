import { getConnection } from 'typeorm'
import { TestConnection } from '../utils/testConnection'
import { createOrganization } from '../factories/organization.factory'
import { Organization } from '../../src/entities/organization'
import { expect, use } from 'chai'
import { LIST_MEMBERSHIPS } from '../utils/operations/organizationOps'
import { createUser } from '../factories/user.factory'
import { User } from '../../src/entities/user'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { pick } from 'lodash'
import { loadFixtures } from '../utils/fixtures'
import supertest from 'supertest'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { print } from 'graphql'
import { createRole } from '../factories/role.factory'
import { makeRequest } from './utils'

const request = supertest('http://localhost:8080/user')

use(deepEqualInAnyOrder)

describe('acceptance.OrganizationMembership', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        await loadFixtures('users', connection)
    })

    context('loaders', () => {
        context('user', () => {
            const primaryKey = (membership: OrganizationMembership) =>
                connection
                    .getRepository(OrganizationMembership)
                    .getId(membership)

            let organization: Organization
            let dbMemberships: OrganizationMembership[]
            let users: User[]
            beforeEach(async () => {
                organization = await createOrganization().save()

                const rawUsers = Array(5).fill(0).map(createUser)
                users = await User.save(rawUsers)

                const rawMemberships = users.map((user) =>
                    createOrganizationMembership({ user, organization })
                )
                dbMemberships = await OrganizationMembership.save(
                    rawMemberships
                )

                // Create other data which should not be included in the result
                const otherOrg = await createOrganization().save()
                const otherUser = await createUser().save()
                const otherMemberships = [
                    createOrganizationMembership({
                        user: users[0],
                        organization: otherOrg,
                    }),
                    createOrganizationMembership({
                        user: otherUser,
                        organization: otherOrg,
                    }),
                ]
                await OrganizationMembership.save(otherMemberships)
            })

            it('it loads nested User relationships', async () => {
                const response = await request
                    .post('/graphql')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(LIST_MEMBERSHIPS),
                        variables: {
                            organization_id: organization.organization_id,
                        },
                    })

                const memberships = response.body.data?.organization
                    ?.memberships as OrganizationMembership[]

                expect(memberships).to.have.length(5)

                const ids = memberships.map(primaryKey)

                expect(ids).to.deep.equalInAnyOrder(
                    dbMemberships.map(primaryKey)
                )

                expect(
                    memberships.every(
                        async (m) =>
                            m.organization_id === organization.organization_id
                    )
                ).to.be.true

                expect(memberships.map((m) => m.user_id)).to.deep.equal(
                    await Promise.all(
                        memberships.map(async (m) => (await m?.user)?.user_id)
                    )
                )

                expect(memberships.map((m) => m?.user)).to.deep.equal(
                    users.map((user) =>
                        pick(
                            user,
                            'user_id',
                            'username',
                            'given_name',
                            'family_name',
                            'email',
                            'avatar'
                        )
                    )
                )
            })
        })
    })

    context('organizationMembershipConnection', () => {
        it('has rolesConnection as a child', async () => {
            const query = `
                query rolesConnection($orgId: ID!, $direction: ConnectionDirection!, $filter: RoleFilter) {
                    # we don't expose membership connections at top-level
                    # so have to go via a node
                    organizationNode(id: $orgId){
                        organizationMembershipsConnection{
                            edges {
                                node {
                                    organizationId,
                                    rolesConnection(direction:$direction, filter: $filter){
                                        edges{
                                            node{
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            const organization = await createOrganization().save()
            const role = await createRole('role1', organization).save()
            const organizationMember = await createUser().save()
            await createOrganizationMembership({
                user: organizationMember,
                organization,
                roles: [role],
            }).save()

            const token = generateToken({
                id: organizationMember.user_id,
                email: organizationMember.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    orgId: organization.organization_id,
                    direction: 'FORWARD',
                    filter: {
                        name: {
                            operator: 'eq',
                            value: role.role_name,
                        },
                    },
                },
                token
            )

            expect(response.status).to.eq(200)
            expect(
                response.body.data.organizationNode
                    .organizationMembershipsConnection.edges[0].node
                    .organizationId
            ).to.eq(organization.organization_id)
            expect(
                response.body.data.organizationNode
                    .organizationMembershipsConnection.edges[0].node
                    .rolesConnection.edges[0].node.id
            ).to.eq(role.role_id)
        })
    })
})
