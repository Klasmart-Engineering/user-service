import { expect } from 'chai'
import supertest from 'supertest'
import { getConnection } from 'typeorm'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRange'
import { loadFixtures } from '../utils/fixtures'
import {
    createAgeRanges,
    createOrg,
    IAgeRangeDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import {
    AGE_RANGES_CONNECTION,
    AGE_RANGE_NODE,
} from '../utils/operations/modelOps'
import { generateToken } from '../utils/testConfig'
import { TestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { Organization } from '../../src/entities/organization'
import { User } from '../../src/entities/user'
import { createUser } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createAgeRange } from '../factories/ageRange.factory'
import { createProgram } from '../factories/program.factory'
import { makeRequest } from './utils'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { userToPayload } from '../utils/operations/userOps'

interface IAgeRangeEdge {
    node: AgeRangeConnectionNode
}

let systemAgeRangesCount = 0
const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const ageRangesCount = 12

const makeConnectionQuery = async (token: string) => {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: AGE_RANGES_CONNECTION,
            variables: {
                direction: 'FORWARD',
            },
        })
}

const makeNodeQuery = async (id: string, token: string) => {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: print(AGE_RANGE_NODE),
            variables: {
                id,
            },
        })
}

describe('acceptance.ageRange', () => {
    let connection: TestConnection
    let adminToken: string

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()
        await loadFixtures('users', connection)

        const adminUser = await createUser({
            email: UserPermissions.ADMIN_EMAILS[0],
        }).save()

        adminToken = await generateToken(userToPayload(adminUser))
        const ageRangeDetails: IAgeRangeDetail[] = []
        const createOrgResponse = await createOrg(user_id, org_name, adminToken)

        const createOrgData =
            createOrgResponse.body.data.user.createOrganization

        const orgId = createOrgData.organization_id

        for (let i = 1; i <= ageRangesCount; i++) {
            ageRangeDetails.push({
                name: `age range ${i}`,
                low_value: i,
                low_value_unit: AgeRangeUnit.YEAR,
                high_value: i + 1,
                high_value_unit: AgeRangeUnit.YEAR,
            })
        }

        for (let i = 1; i <= ageRangesCount; i++) {
            ageRangeDetails.push({
                name: `age range ${i}`,
                low_value: i,
                low_value_unit: AgeRangeUnit.MONTH,
                high_value: i + 1,
                high_value_unit: AgeRangeUnit.MONTH,
            })
        }

        await createAgeRanges(orgId, ageRangeDetails, adminToken)

        systemAgeRangesCount = await connection.manager.count(AgeRange, {
            where: { system: true },
        })
    })

    context('ageRangesConnection', () => {
        it('queries paginated age ranges', async () => {
            const response = await makeConnectionQuery(adminToken)

            const ageRangesConnection = response.body.data.ageRangesConnection

            expect(response.status).to.eq(200)
            expect(ageRangesConnection.totalCount).to.equal(
                ageRangesCount * 2 + systemAgeRangesCount
            )
        })

        it('queries paginated age ranges filtered by age range from', async () => {
            const lowValue = 10
            const lowUnit = AgeRangeUnit.YEAR
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: adminToken,
                })
                .send({
                    query: AGE_RANGES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeValueFrom: {
                                operator: 'eq',
                                value: lowValue,
                            },
                            ageRangeUnitFrom: {
                                operator: 'eq',
                                value: lowUnit,
                            },
                        },
                    },
                })

            const ageRangesConnection = response.body.data.ageRangesConnection

            expect(response.status).to.eq(200)
            expect(ageRangesConnection.totalCount).to.equal(1)

            const filteredAgeRanges = ageRangesConnection.edges.map(
                (edge: IAgeRangeEdge) => edge.node
            )

            filteredAgeRanges.every((ar: AgeRangeConnectionNode) => {
                expect(ar.lowValue).eq(lowValue)
                expect(ar.lowValueUnit).eq(lowUnit)
            })
        })

        it('queries paginated age ranges filtered by age range to', async () => {
            const highValue = 10
            const highUnit = AgeRangeUnit.MONTH
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: adminToken,
                })
                .send({
                    query: AGE_RANGES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeValueTo: {
                                operator: 'eq',
                                value: highValue,
                            },
                            ageRangeUnitTo: {
                                operator: 'eq',
                                value: highUnit,
                            },
                        },
                    },
                })

            const ageRangesConnection = response.body.data.ageRangesConnection

            expect(response.status).to.eq(200)
            expect(ageRangesConnection.totalCount).to.equal(1)

            const filteredAgeRanges = ageRangesConnection.edges.map(
                (edge: IAgeRangeEdge) => edge.node
            )

            filteredAgeRanges.every((ar: AgeRangeConnectionNode) => {
                expect(ar.highValue).eq(highValue)
                expect(ar.highValueUnit).eq(highUnit)
            })
        })
    })

    context('ageRangeNode', () => {
        let ageRangesEdges: IAgeRangeEdge[]
        beforeEach(async () => {
            const ageRangeResponse = await makeConnectionQuery(adminToken)
            ageRangesEdges =
                ageRangeResponse.body.data.ageRangesConnection.edges
        })
        context('when requested age range exists', () => {
            it('should respond succesfully', async () => {
                const ageRangeId = ageRangesEdges[0].node.id
                const response = await makeNodeQuery(ageRangeId, adminToken)
                const ageRangeNode = response.body.data.ageRangeNode

                expect(response.status).to.eq(200)
                expect(ageRangeNode.id).to.equal(ageRangeId)
            })
        })

        context('when requested age range does not exists', () => {
            it('should respond with errors', async () => {
                const ageRangeId = '00000000-0000-0000-0000-000000000000'
                const response = await makeNodeQuery(ageRangeId, adminToken)
                const errors = response.body.errors
                const ageRangeNode = response.body.data.ageRangeNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(ageRangeNode).to.be.null
            })
        })
    })

    context('ageRangesConnection as a child', () => {
        let user: User
        let organization: Organization
        let token: string
        beforeEach(async () => {
            user = await createUser().save()
            organization = await createOrganization(user).save()
            await createOrganizationMembership({
                user,
                organization,
            }).save()
            const ageRange = await createAgeRange(organization).save()
            await createProgram(organization, [ageRange]).save()

            token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })
        })
        it('returns age ranges per program', async () => {
            const query = `
            query programsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $sortArgs: ProgramSortInput){
                programsConnection(direction: $direction, directionArgs: $directionArgs, sort: $sortArgs) {
                    totalCount
                    edges {
                        cursor
                        node {
                            id
                            ageRangesConnection(direction: FORWARD){
                              totalCount
                              edges {
                                  cursor
                                  node {
                                      id
                                  }
                              }
                            }
                        }
                    }
                }
            }`

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                    directionArgs: { count: 1 },
                    sortArgs: { order: 'ASC', field: 'name' },
                },
                token
            )
            expect(response.status).to.eq(200)
            expect(
                response.body.data.programsConnection.edges[0].node
                    .ageRangesConnection.totalCount
            ).to.be.gte(1)
        })
        it('returns age ranges per organization as well as system age ranges', async () => {
            const query = `
            query organizationsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $sortArgs: OrganizationSortInput) {
                organizationsConnection(direction: $direction, directionArgs: $directionArgs, sort: $sortArgs) {
                    totalCount
                    edges {
                        cursor
                        node {
                            id
                            ageRangesConnection(direction: FORWARD){
                              totalCount
                              edges {
                                  cursor
                                  node {
                                      id
                                  }
                              }
                            }
                        }
                    }
                }
            }`

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                    directionArgs: { count: 1 },
                    sortArgs: { order: 'ASC', field: 'name' },
                },
                token
            )

            expect(response.status).to.eq(200)
            expect(
                response.body.data.organizationsConnection.edges[0].node
                    .ageRangesConnection.totalCount
            ).to.eq(1 + systemAgeRangesCount)
        })
    })
})
