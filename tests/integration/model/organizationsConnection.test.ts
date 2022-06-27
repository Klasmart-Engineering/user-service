import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { sortBy } from 'lodash'
import { getConnection } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { OrganizationOwnership } from '../../../src/entities/organizationOwnership'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import {
    CoreOrganizationConnectionNode,
    mapOrganizationToOrganizationConnectionNode,
} from '../../../src/pagination/organizationsConnection'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { OrganizationConnectionNode } from '../../../src/types/graphQL/organization'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import {
    convertDataToCursor,
    IEdge,
} from '../../../src/utils/pagination/paginate'
import { generateShortCode } from '../../../src/utils/shortcode'
import { createClass } from '../../factories/class.factory'
import {
    createOrganization,
    createOrganizations,
} from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createOrganizationOwnership } from '../../factories/organizationOwnership.factory'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createAdminUser, createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    organizationsConnection,
    organizationsConnectionMainData,
    organizationsConnectionNodes,
    runQuery,
} from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken, getNonAdminAuthToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { createNonAdminUser } from '../../utils/testEntities'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('organizationsConnection', () => {
    let organizationsList: Organization[] = []
    const direction = 'FORWARD'
    let connection: TestConnection
    let adminUser: User
    let adminToken: string
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        adminUser = await createAdminUser().save()
        adminToken = generateToken(userToPayload(adminUser))
    })

    const expectOrganizationConnectionEdge = (
        edge: IEdge<OrganizationConnectionNode>,
        organization: Organization
    ) => {
        expect(edge.node).to.deep.equal({
            id: organization.organization_id,
            name: organization.organization_name,
            shortCode: organization.shortCode,
            status: organization.status,
            contactInfo: {
                address1: organization.address1,
                address2: organization.address2,
                phone: organization.phone,
            },
        } as Required<CoreOrganizationConnectionNode>)
    }

    context('data', () => {
        beforeEach(async () => {
            organizationsList = await Organization.save(
                Array(2)
                    .fill(undefined)
                    .map((_) => {
                        const organization = createOrganization()
                        // Populate fields not set in `createOrganization`
                        organization.address1 = faker.address.streetAddress()
                        organization.address2 = faker.address.secondaryAddress()
                        organization.phone = faker.phone.phoneNumber()
                        return organization
                    })
            )
            organizationsList = sortBy(organizationsList, 'organization_id')
        })

        it('populates a OrganizationConnectionNode at each edge.node based on the Organization entity', async () => {
            const organizationConnectionResponse = await organizationsConnectionNodes(
                testClient,
                { authorization: adminToken }
            )

            expect(organizationConnectionResponse.edges).to.have.length(2)
            organizationConnectionResponse.edges.forEach((edge, i) =>
                expectOrganizationConnectionEdge(edge, organizationsList[i])
            )
        })
    })

    context('permissions', () => {
        let organization: Organization
        let user: User
        let anotherUser: User
        let token: string

        beforeEach(async () => {
            organizationsList = await Organization.save(createOrganizations(3))

            // order organizations by organization ID
            organizationsList = sortBy(organizationsList, 'organization_id')
        })

        /**
         * Test whether all `OrganizationFilter` options can be successfully applied
         * Specific return edges are tested in the `filter` context
         */
        const testOrganizationFilters = () =>
            ([
                {
                    id: {
                        operator: 'eq',
                        value: faker.datatype.uuid(),
                    },
                },
                {
                    name: {
                        operator: 'eq',
                        value: faker.random.word(),
                    },
                },
                {
                    phone: {
                        operator: 'eq',
                        value: faker.phone.phoneNumber('+44#######'),
                    },
                },
                {
                    shortCode: {
                        operator: 'eq',
                        value: generateShortCode(),
                    },
                },
                {
                    status: {
                        operator: 'eq',
                        value: Status.ACTIVE,
                    },
                },
                {
                    ownerUserId: {
                        operator: 'eq',
                        value: faker.datatype.uuid(),
                    },
                },
                {
                    userId: {
                        operator: 'eq',
                        value: faker.datatype.uuid(),
                    },
                },
            ] as IEntityFilter[]).forEach((filter) =>
                it(`filters on ${Object.keys(filter)[0]}`, async () => {
                    return await expect(
                        organizationsConnection(
                            testClient,
                            'FORWARD',
                            { count: 1 },
                            { authorization: token },
                            filter
                        )
                    ).to.be.fulfilled
                })
            )

        context('admin', () => {
            it('returns all organizations when user does not belong to any organizations', async () => {
                const organizationsConnectionResponse = await organizationsConnectionNodes(
                    testClient,
                    { authorization: adminToken }
                )

                expect(organizationsConnectionResponse.edges).to.have.length(
                    organizationsList.length
                )
            })

            it('returns all organizations when user belongs to an organization', async () => {
                // add user into an organization
                await OrganizationMembership.save(
                    createOrganizationMembership({
                        user: adminUser,
                        organization: organizationsList[0],
                    })
                )

                const organizationsConnectionResponse = await organizationsConnectionNodes(
                    testClient,
                    { authorization: adminToken }
                )

                expect(organizationsConnectionResponse.edges).to.have.length(
                    organizationsList.length
                )
            })
        })

        context('non-admin', () => {
            beforeEach(async () => {
                organization = organizationsList[0]

                // create an user
                user = createUser()
                await user.save()

                // add the user into an organization
                await OrganizationMembership.save(
                    createOrganizationMembership({
                        user,
                        organization: organization,
                    })
                )

                // create another user with same email
                anotherUser = createUser()
                anotherUser.email = user.email
                await anotherUser.save()

                // add the user into an organization
                await OrganizationMembership.save(
                    createOrganizationMembership({
                        user: anotherUser,
                        organization: organizationsList[1],
                    })
                )

                token = generateToken(userToPayload(anotherUser))
            })

            it('returns only organizations that the user belongs to', async () => {
                const organizationsConnectionResponse = await organizationsConnection(
                    testClient,
                    direction,
                    null,
                    {
                        authorization: generateToken(userToPayload(user)),
                    }
                )

                expect(organizationsConnectionResponse?.totalCount).to.eql(1)
                expect(organizationsConnectionResponse?.edges.length).to.equal(
                    1
                )
                expect(
                    organizationsConnectionResponse.edges[0].node.id
                ).to.deep.equal(organizationsList[0].organization_id)
            })

            testOrganizationFilters()
        })
    })

    context('pagination', () => {
        beforeEach(async () => {
            organizationsList = await Organization.save(createOrganizations(10))

            // sort organizations by organization ID
            organizationsList.sort((a, b) =>
                a.organization_id > b.organization_id ? 1 : -1
            )
        })

        it('gets the next few records according to pagesize and start cursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({
                    organization_id: organizationsList[3].organization_id,
                }),
            }
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: adminToken }
            )

            expect(organizationsConnectionResponse?.totalCount).to.eql(10)
            expect(organizationsConnectionResponse?.edges.length).to.equal(3)

            for (let i = 0; i < 3; i++) {
                expect(
                    organizationsConnectionResponse?.edges[i].node.id
                ).to.equal(organizationsList[4 + i].organization_id)
            }
            expect(
                organizationsConnectionResponse?.pageInfo.startCursor
            ).to.equal(
                convertDataToCursor({
                    organization_id: organizationsList[4].organization_id,
                })
            )
            expect(
                organizationsConnectionResponse?.pageInfo.endCursor
            ).to.equal(
                convertDataToCursor({
                    organization_id: organizationsList[6].organization_id,
                })
            )
            expect(organizationsConnectionResponse?.pageInfo.hasNextPage).to.be
                .true
            expect(organizationsConnectionResponse?.pageInfo.hasPreviousPage).to
                .be.true
        })
    })

    context('sorting', () => {
        let owners: User[]
        const orgsCount = 6

        beforeEach(async () => {
            owners = await User.save(
                Array.from(new Array(orgsCount), (_, i) =>
                    createUser({ email: `owner${i}@gmail.com` })
                )
            )

            organizationsList = await Organization.save(
                Array.from(owners, (owner) => createOrganization(owner))
            )

            await OrganizationOwnership.save(
                Array.from(organizationsList, (org, i) =>
                    createOrganizationOwnership({
                        user: owners[i],
                        organization: org,
                    })
                )
            )
        })

        it('sorts by name', async () => {
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: adminToken },
                undefined,
                {
                    field: 'name',
                    order: 'ASC',
                }
            )

            const organizationOrderedByNameAsc = [
                ...organizationsList,
            ].sort((a, b) =>
                a
                    .organization_name!.toLowerCase()
                    .localeCompare(b.organization_name!.toLowerCase())
            )

            for (
                let i = 0;
                i < organizationsConnectionResponse.edges.length;
                i++
            ) {
                expect(
                    organizationsConnectionResponse.edges[i].node.name
                ).to.eq(organizationOrderedByNameAsc[i].organization_name)
            }
        })

        it('sorts by owner email', async () => {
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: adminToken },
                undefined,
                {
                    field: 'ownerEmail',
                    order: 'ASC',
                }
            )

            const { totalCount, edges } = organizationsConnectionResponse
            expect(totalCount).to.equal(orgsCount)
            expect(edges).to.have.lengthOf(3)

            edges.forEach((edge, i) => {
                const owner = edge.node.owners![0]
                expect(owner.email).to.eq(`owner${i}@gmail.com`)
            })
        })

        it('works with filtering', async () => {
            const organizationsOrderedByNameAsc = [
                ...organizationsList,
            ].sort((a, b) =>
                a.organization_name!.localeCompare(b.organization_name!)
            )
            const filter: IEntityFilter = {
                name: {
                    operator: 'neq',
                    value: organizationsOrderedByNameAsc[0].organization_name!,
                },
            }

            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: adminToken },
                filter,
                {
                    field: 'name',
                    order: 'ASC',
                }
            )

            for (
                let i = 0;
                i < organizationsConnectionResponse.edges.length;
                i++
            ) {
                expect(
                    organizationsConnectionResponse.edges[i].node.name
                ).to.eq(organizationsOrderedByNameAsc[i + 1].organization_name)
            }
        })
    })

    context('id filtering', () => {
        beforeEach(async () => {
            organizationsList = await Organization.save(createOrganizations(3))
        })

        it('supports `eq` operator', async () => {
            const organizationsConnectionResponse = await organizationsConnectionNodes(
                testClient,
                { authorization: adminToken },
                {
                    id: {
                        operator: 'eq',
                        value: organizationsList[0].organization_id,
                    },
                }
            )

            expect(
                organizationsConnectionResponse.edges.map((edge) => edge.node)
            ).to.deep.equal([
                mapOrganizationToOrganizationConnectionNode(
                    organizationsList[0]
                ),
            ])
        })

        it('supports `neq` operator', async () => {
            const organizationsConnectionResponse = await organizationsConnectionNodes(
                testClient,
                { authorization: adminToken },
                {
                    id: {
                        operator: 'neq',
                        value: organizationsList[0].organization_id,
                    },
                }
            )

            expect(
                organizationsConnectionResponse.edges.map((edge) => edge.node)
            ).to.deep.equalInAnyOrder(
                organizationsList
                    .slice(1)
                    .map(mapOrganizationToOrganizationConnectionNode)
            )
        })
    })

    context('shortCode filtering', () => {
        beforeEach(async () => {
            organizationsList = []

            // create 3 organizations
            for (let i = 0; i < 3; i++) {
                const organization = createOrganization()
                organization.shortCode = `ORG0${i}`
                organizationsList.push(organization)
            }

            await connection.manager.save(organizationsList)
        })

        it('supports `contains` (case insensitive)', async () => {
            const filter: IEntityFilter = {
                shortCode: {
                    operator: 'contains',
                    caseInsensitive: true,
                    value: 'org',
                },
            }
            const directionArgs = {
                count: 3,
            }
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: adminToken },
                filter
            )

            expect(organizationsConnectionResponse?.totalCount).to.eql(3)
            expect(organizationsConnectionResponse?.edges.length).to.equal(3)
            expect(organizationsConnectionResponse?.pageInfo.hasNextPage).to.be
                .false
            expect(organizationsConnectionResponse?.pageInfo.hasPreviousPage).to
                .be.false
        })

        it('supports `contains` (case sensitive)', async () => {
            const filter: IEntityFilter = {
                shortCode: {
                    operator: 'contains',
                    caseInsensitive: false,
                    value: 'org',
                },
            }
            const directionArgs = {
                count: 3,
            }
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: adminToken },
                filter
            )

            expect(organizationsConnectionResponse?.totalCount).to.eql(0)
            expect(organizationsConnectionResponse?.edges.length).to.equal(0)
            expect(organizationsConnectionResponse?.pageInfo.hasNextPage).to.be
                .false
            expect(organizationsConnectionResponse?.pageInfo.hasPreviousPage).to
                .be.false
        })

        it('supports `eq` (case insensitive)', async () => {
            const filter: IEntityFilter = {
                shortCode: {
                    operator: 'eq',
                    caseInsensitive: true,
                    value: 'org01',
                },
            }
            const directionArgs = {
                count: 3,
            }
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: adminToken },
                filter
            )

            expect(organizationsConnectionResponse?.totalCount).to.eql(1)
            expect(organizationsConnectionResponse?.edges.length).to.equal(1)
            expect(organizationsConnectionResponse?.pageInfo.hasNextPage).to.be
                .false
            expect(organizationsConnectionResponse?.pageInfo.hasPreviousPage).to
                .be.false
        })

        it('supports `eq` (case sensitive)', async () => {
            const filter: IEntityFilter = {
                shortCode: {
                    operator: 'eq',
                    caseInsensitive: false,
                    value: 'org01',
                },
            }
            const directionArgs = {
                count: 3,
            }
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: adminToken },
                filter
            )

            expect(organizationsConnectionResponse?.totalCount).to.eql(0)
            expect(organizationsConnectionResponse?.edges.length).to.equal(0)
            expect(organizationsConnectionResponse?.pageInfo.hasNextPage).to.be
                .false
            expect(organizationsConnectionResponse?.pageInfo.hasPreviousPage).to
                .be.false
        })
    })

    context('status filtering', () => {
        beforeEach(async () => {
            organizationsList = []

            // create 3 organizations
            for (let i = 0; i < 3; i++) {
                const organization = createOrganization()
                organization.status = Status.ACTIVE
                organizationsList.push(organization)
            }

            await connection.manager.save(organizationsList)

            // change status for first organization
            organizationsList[0].status = Status.INACTIVE
            await connection.manager.save(organizationsList.slice(0, 2))
        })

        it('filters on status', async () => {
            const organizationsConnectionResponse = await organizationsConnectionNodes(
                testClient,
                { authorization: adminToken },
                {
                    status: {
                        operator: 'eq',
                        value: Status.INACTIVE,
                    },
                }
            )

            expect(
                organizationsConnectionResponse.edges.map((edge) => edge.node)
            ).to.deep.equal([
                mapOrganizationToOrganizationConnectionNode(
                    organizationsList[0]
                ),
            ])
        })
    })

    context('phone filtering', () => {
        beforeEach(async () => {
            organizationsList = []

            // create 5 organizations
            for (let i = 0; i < 5; i++) {
                const organization = createOrganization()
                organization.phone = '000000000'
                organizationsList.push(organization)
            }

            await connection.manager.save(organizationsList)

            // sort organizations by id
            organizationsList.sort((a, b) =>
                a.organization_id > b.organization_id ? 1 : -1
            )

            // add phone number to 2 organizations
            organizationsList[0].phone = '123456789'
            organizationsList[1].phone = '456789123'
            await connection.manager.save(organizationsList.slice(0, 2))
        })

        it('filters on phone', async () => {
            const filter: IEntityFilter = {
                phone: {
                    operator: 'contains',
                    caseInsensitive: true,
                    value: '123',
                },
            }
            const directionArgs = {
                count: 3,
            }
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: adminToken },
                filter
            )
            expect(organizationsConnectionResponse?.totalCount).to.eql(2)
            expect(organizationsConnectionResponse?.edges.length).to.equal(2)
            expect(organizationsConnectionResponse?.edges[0].node.id).to.equal(
                organizationsList[0].organization_id
            )
            expect(organizationsConnectionResponse?.edges[1].node.id).to.equal(
                organizationsList[1].organization_id
            )

            expect(organizationsConnectionResponse?.pageInfo.hasNextPage).to.be
                .false
            expect(organizationsConnectionResponse?.pageInfo.hasPreviousPage).to
                .be.false
        })
    })

    context('ownerUserId filtering', () => {
        let organization: Organization
        let anotherOrganization: Organization
        let user: User
        let anotherUser: User

        beforeEach(async () => {
            // create an user then add to an organization
            organization = await Organization.save(createOrganization())
            user = await User.save(createUser())
            await OrganizationMembership.save(
                createOrganizationMembership({
                    user,
                    organization,
                })
            )
            await OrganizationOwnership.save(
                createOrganizationOwnership({
                    user,
                    organization,
                })
            )

            // create another user then add to another organization
            anotherUser = await User.save(createUser())
            anotherOrganization = await Organization.save(
                createOrganization(anotherUser)
            )

            await OrganizationMembership.save(
                createOrganizationMembership({
                    user: anotherUser,
                    organization: anotherOrganization,
                })
            )
            await OrganizationOwnership.save(
                createOrganizationOwnership({
                    user: anotherUser,
                    organization: anotherOrganization,
                })
            )
        })

        it('returns only organizations that has owner user ID same with filter value', async () => {
            const organizationsConnectionResponse = await organizationsConnectionNodes(
                testClient,
                { authorization: adminToken },
                {
                    ownerUserId: {
                        operator: 'eq',
                        value: anotherUser.user_id,
                    },
                }
            )

            expect(organizationsConnectionResponse?.edges.length).to.equal(1)
            expect(
                organizationsConnectionResponse.edges[0].node.id
            ).to.deep.equal(anotherOrganization.organization_id)
        })
    })

    context('ownerUserEmail filtering', () => {
        let owners: User[]
        let orgs: Organization[]
        const ownersCount = 10
        const domains = ['gmail.com', 'yahoo.com']

        beforeEach(async () => {
            owners = await User.save(
                Array.from(new Array(ownersCount), (_, i) => {
                    const domain = i < ownersCount / 2 ? domains[0] : domains[1]
                    return createUser({ email: `owner${i}@${domain}` })
                })
            )

            orgs = await Organization.save(
                Array.from(owners, (owner) => createOrganization(owner))
            )

            await OrganizationOwnership.save(
                Array.from(orgs, (org, i) =>
                    createOrganizationOwnership({
                        user: owners[i],
                        organization: org,
                    })
                )
            )
        })

        it('returns only organizations which owner user email is equal to the filter value', async () => {
            const ownerEmail = owners[0].email
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                {},
                { authorization: adminToken },
                {
                    ownerUserEmail: {
                        operator: 'eq',
                        value: ownerEmail,
                    },
                }
            )

            const { totalCount, edges } = organizationsConnectionResponse
            expect(totalCount).to.equal(1)
            expect(edges).to.have.lengthOf(1)

            const responseEmails = edges.map((e) => e.node.owners![0].email)
            expect(responseEmails).to.deep.equalInAnyOrder([ownerEmail])
        })

        it('returns only organizations which owner user email contains the filter value', async () => {
            const organizationsConnectionResponse = await organizationsConnection(
                testClient,
                direction,
                {},
                { authorization: adminToken },
                {
                    ownerUserEmail: {
                        operator: 'contains',
                        value: domains[0],
                    },
                }
            )

            const { totalCount, edges } = organizationsConnectionResponse
            expect(totalCount).to.equal(ownersCount / 2)
            expect(edges).to.have.lengthOf(ownersCount / 2)

            const responseEmails = edges.map((e) => e.node.owners![0].email)
            const ownerEmails = owners
                .slice(0, ownersCount / 2)
                .map((o) => o.email)

            expect(responseEmails).to.deep.equalInAnyOrder(ownerEmails)
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({
                    id: organizationsList[3].organization_id,
                }),
            }

            await organizationsConnectionMainData(
                testClient,
                direction,
                directionArgs,
                false,
                {
                    authorization: adminToken,
                }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('child connections', () => {
        const numUsersPerOrg = 10
        const numSchoolsPerOrg = 10
        const numClassesPerOrg = numSchoolsPerOrg
        let orgs: Organization[]
        let school: School
        let class_: Class

        beforeEach(async () => {
            orgs = [createOrganization(), createOrganization()]
            await connection.manager.save(orgs)
            for (let i = 0; i < numUsersPerOrg; i++) {
                for (const org of orgs) {
                    const user = await createUser().save()
                    await createOrganizationMembership({
                        user,
                        organization: org,
                    }).save()
                }
            }
            for (let i = 0; i < numSchoolsPerOrg; i++) {
                for (const org of orgs) {
                    school = await createSchool(org).save()
                    class_ = await createClass(
                        [school],
                        org,
                        {},
                        `class${i}`
                    ).save()
                }
            }
        })
        context('.organizationMembershipsConnection', () => {
            it('returns organization members', async () => {
                const usersPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: adminToken }
                )
                expect(usersPerOrg.edges.length).to.eq(2)
                for (const orgUsers of usersPerOrg.edges) {
                    const memberships = orgUsers.node
                        .organizationMembershipsConnection!
                    expect(memberships.totalCount).to.eq(numUsersPerOrg)
                    expect(memberships.edges.length).to.eq(numUsersPerOrg)
                    for (const edge of memberships.edges) {
                        expect(edge.node.organizationId).to.eq(orgUsers.node.id)
                        expect(edge.node.organizationId).to.eq(
                            edge.node.organization?.id
                        )
                        expect(edge.node.userId).to.eq(edge.node.user?.id)
                    }
                }
            })
        })

        context('.schoolsConnection', async () => {
            it('returns school users', async () => {
                const schoolsPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: adminToken }
                )
                expect(schoolsPerOrg.edges.length).to.eq(2)
                for (const orgUsers of schoolsPerOrg.edges) {
                    expect(orgUsers.node.schoolsConnection?.totalCount).to.eq(
                        numSchoolsPerOrg
                    )
                }
            })
            it('uses the isAdmin scope for permissions', async () => {
                // create a non-admin user and add to a school in org1
                const nonAdmin = await createNonAdminUser(testClient)
                const membership = await createOrganizationMembership({
                    user: nonAdmin,
                    organization: orgs[0],
                }).save()
                await createSchoolMembership({
                    user: nonAdmin,
                    school: (await orgs[0].schools)![0],
                }).save()

                // can't see any schools without permissions
                let schoolsPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(schoolsPerOrg.totalCount).to.eq(1)
                expect(
                    schoolsPerOrg.edges[0].node.schoolsConnection?.totalCount
                ).to.eq(0)

                // can see all other schools with required permissions
                const role = await createRole('role', orgs[0], {
                    permissions: [PermissionName.view_school_20110],
                }).save()
                membership.roles = Promise.resolve([role])
                await membership.save()
                schoolsPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(schoolsPerOrg.totalCount).to.eq(1)
                expect(
                    schoolsPerOrg.edges[0].node.schoolsConnection?.totalCount
                ).to.eq(numSchoolsPerOrg)
            })
        })

        context('.classesConnection', async () => {
            it('returns classes for user', async () => {
                const classesPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: adminToken }
                )
                expect(classesPerOrg.edges.length).to.eq(2)
                for (const orgUsers of classesPerOrg.edges) {
                    expect(orgUsers.node.classesConnection?.totalCount).to.eq(
                        numClassesPerOrg
                    )
                }
            })
            it('uses the isAdmin scope for permissions', async () => {
                // create a non-admin user and add to a school in org1
                const nonAdmin = await createNonAdminUser(testClient)
                const membership = await createOrganizationMembership({
                    user: nonAdmin,
                    organization: orgs[0],
                }).save()
                await createSchoolMembership({
                    user: nonAdmin,
                    school: (await orgs[0].schools)![0],
                }).save()
                // can't see any classes without permissions
                let classesPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(classesPerOrg.totalCount).to.eq(1)
                expect(
                    classesPerOrg.edges[0].node.classesConnection?.totalCount
                ).to.eq(0)
                // can see all other classes with required permissions
                const role = await createRole('role', orgs[0], {
                    permissions: [PermissionName.view_classes_20114],
                }).save()
                membership.roles = Promise.resolve([role])
                await membership.save()
                classesPerOrg = await organizationsConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(classesPerOrg.totalCount).to.eq(1)
                expect(
                    classesPerOrg.edges[0].node.classesConnection?.totalCount
                ).to.eq(numClassesPerOrg)
            })
        })
        it('dataloads child connections', async () => {
            const expectedCount = 9

            const query = `
                query {
                    organizationsConnection(direction: FORWARD) {   # 1
                        edges {
                            node {
                                organizationMembershipsConnection {                   
                                    totalCount                      # 2 
                                    edges {                         # 3
                                        node {
                                            userId
                                        }
                                    }
                                }
                                schoolsConnection {
                                    totalCount                      # 4
                                    edges {                         # 5
                                        node {
                                            id
                                        }
                                    }
                                }
                                rolesConnection {
                                    totalCount                      # 6
                                    edges {                         # 7
                                        node {
                                            id
                                        }
                                    }
                                }
                                classesConnection {
                                    totalCount                      # 8
                                    edges {                         # 9
                                        node {
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `

            connection.logger.reset()
            await runQuery(query, testClient, {
                authorization: adminToken,
            })
            expect(connection.logger.count).to.be.eq(expectedCount)

            // async isAdmin directives break dataloading
            // so ensure that is not happening
            const nonAdmin = await createNonAdminUser(testClient)
            const role = await createRole('role', orgs[0], {
                permissions: [
                    PermissionName.view_users_40110,
                    PermissionName.view_school_20110,
                    PermissionName.view_classes_20114,
                ],
            }).save()
            await createOrganizationMembership({
                user: nonAdmin,
                organization: orgs[0],
                roles: [role],
            }).save()

            connection.logger.reset()
            await runQuery(query, testClient, {
                authorization: getNonAdminAuthToken(),
            })
            expect(connection.logger.count).to.be.eq(
                expectedCount + 2,
                'two extra for permission checks (orgMemberships, schoolMemberships)'
            )
        })
    })
})
