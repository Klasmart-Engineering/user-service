import { expect } from 'chai'
import supertest from 'supertest'
import { getConnection } from 'typeorm'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import {
    AgeRangeConnectionNode,
    UpdateAgeRangeInput,
} from '../../src/types/graphQL/ageRange'
import { loadFixtures } from '../utils/fixtures'
import {
    createAgeRanges,
    createOrg,
    IAgeRangeDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import {
    AGE_RANGES_CONNECTION,
    AGE_RANGE_NODE,
    UPDATE_AGE_RANGES,
} from '../utils/operations/modelOps'
import { generateToken, getAPIKeyAuth } from '../utils/testConfig'
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
import {
    CREATE_AGE_RANGES,
    buildUpdateAgeRangeInputArray,
    DELETE_AGE_RANGES,
} from '../utils/operations/ageRangeOps'
import { userToPayload } from '../utils/operations/userOps'
import { UserPermissions } from '../../src/permissions/userPermissions'

interface IAgeRangeEdge {
    node: AgeRangeConnectionNode
}

let systemAgeRangesCount = 0
const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const ageRangesCount = 12

const makeConnectionQuery = async () => {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: getAPIKeyAuth(),
        })
        .send({
            query: AGE_RANGES_CONNECTION,
            variables: {
                direction: 'FORWARD',
            },
        })
}

const makeNodeQuery = async (id: string) => {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAPIKeyAuth(),
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

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()
        await loadFixtures('users', connection)

        const ageRangeDetails: IAgeRangeDetail[] = []
        const createOrgResponse = await createOrg(user_id, org_name)

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

        await createAgeRanges(orgId, ageRangeDetails, getAPIKeyAuth())

        systemAgeRangesCount = await connection.manager.count(AgeRange, {
            where: { system: true },
        })
    })

    context('ageRangesConnection', () => {
        it('queries paginated age ranges', async () => {
            const response = await makeConnectionQuery()

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
                    Authorization: getAPIKeyAuth(),
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
                    Authorization: getAPIKeyAuth(),
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
            const ageRangeResponse = await makeConnectionQuery()
            ageRangesEdges =
                ageRangeResponse.body.data.ageRangesConnection.edges
        })
        context('when requested age range exists', () => {
            it('should respond succesfully', async () => {
                const ageRangeId = ageRangesEdges[0].node.id
                const response = await makeNodeQuery(ageRangeId)
                const ageRangeNode = response.body.data.ageRangeNode

                expect(response.status).to.eq(200)
                expect(ageRangeNode.id).to.equal(ageRangeId)
            })
        })

        context('when requested age range does not exists', () => {
            it('should respond with errors', async () => {
                const ageRangeId = '00000000-0000-0000-0000-000000000000'
                const response = await makeNodeQuery(ageRangeId)
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

    context('createAgeRanges', () => {
        let adminUser: User
        let organization: Organization

        const makeCreateAgeRangesMutation = async (
            input: any,
            caller: User
        ) => {
            return makeRequest(
                request,
                print(CREATE_AGE_RANGES),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            organization = await createOrganization().save()
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [
                    {
                        organizationId: organization.organization_id,
                        name: '11 - 12 year(s)',
                        lowValue: 11,
                        highValue: 12,
                        lowValueUnit: AgeRangeUnit.YEAR,
                        highValueUnit: AgeRangeUnit.YEAR,
                    },
                ]

                const response = await makeCreateAgeRangesMutation(
                    input,
                    adminUser
                )

                const { ageRanges } = response.body.data.createAgeRanges
                expect(response.status).to.eq(200)
                expect(response.body.errors).to.be.undefined
                expect(ageRanges).to.have.lengthOf(input.length)
            })
        })

        it('all the fields are mandatory', async () => {
            const response = await makeCreateAgeRangesMutation([{}], adminUser)
            const { data } = response.body

            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(6)

            expect(response.body.errors[0].message).to.contain(
                'Field "name" of required type "String!" was not provided.'
            )

            expect(response.body.errors[1].message).to.contain(
                'Field "lowValue" of required type "Int!" was not provided.'
            )

            expect(response.body.errors[2].message).to.contain(
                'Field "highValue" of required type "Int!" was not provided.'
            )

            expect(response.body.errors[3].message).to.contain(
                'Field "lowValueUnit" of required type "AgeRangeUnit!" was not provided.'
            )

            expect(response.body.errors[4].message).to.contain(
                'Field "highValueUnit" of required type "AgeRangeUnit!" was not provided.'
            )

            expect(response.body.errors[5].message).to.contain(
                'Field "organizationId" of required type "ID!" was not provided.'
            )
        })
    })

    context('deleteAgeRanges', () => {
        let adminUser: User
        let ageRangeToDelete: AgeRange

        const makeDeleteAgeRangesMutation = async (
            input: any,
            caller: User
        ) => {
            return await makeRequest(
                request,
                print(DELETE_AGE_RANGES),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            const org = await createOrganization().save()
            ageRangeToDelete = await createAgeRange(org).save()
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [{ id: ageRangeToDelete.id }]
                const response = await makeDeleteAgeRangesMutation(
                    input,
                    adminUser
                )

                const { ageRanges } = response.body.data.deleteAgeRanges
                expect(response.status).to.eq(200)
                expect(ageRanges).to.have.lengthOf(input.length)
                expect(response.body.errors).to.be.undefined
            })
        })

        it('has mandatory id field', async () => {
            const response = await makeDeleteAgeRangesMutation([{}], adminUser)
            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "id" of required type "ID!" was not provided.'
            )
        })
    })

    context('updateAgeRanges', () => {
        let ageRangesIds: string[]
        beforeEach(async () => {
            await AgeRangesInitializer.run()
            const org = await createOrganization().save()
            const ageRanges = await AgeRange.save(
                Array.from(new Array(ageRangesCount), (_, i) =>
                    createAgeRange(org)
                )
            )
            ageRangesIds = ageRanges.map((c) => c.id)
        })
        const makeUpdateAgeRangesMutation = async (
            input: UpdateAgeRangeInput[]
        ) => {
            return makeRequest(
                request,
                print(UPDATE_AGE_RANGES),
                { input },
                getAPIKeyAuth()
            )
        }

        context('when age range exist', () => {
            it('should update it', async () => {
                const input = buildUpdateAgeRangeInputArray(
                    ageRangesIds.slice(0, 2)
                )
                const response = await makeUpdateAgeRangesMutation(input)
                const { ageRanges } = response.body.data.updateAgeRanges

                expect(response.status).to.eq(200)
                expect(response.body.errors).to.be.undefined
                expect(ageRanges).to.exist
                expect(ageRanges).to.be.an('array')
                expect(ageRanges.length).to.eq(input.length)

                ageRanges.forEach((c: AgeRangeConnectionNode, i: number) => {
                    expect(c.id).to.eq(input[i].id)
                    expect(c.name).to.eq(input[i].name)
                    expect(c.lowValue).to.eq(input[i].lowValue)
                    expect(c.lowValueUnit).to.eq(input[i].lowValueUnit)
                    expect(c.highValue).to.eq(input[i].highValue)
                    expect(c.highValueUnit).to.eq(input[i].highValueUnit)
                })
            })
        })

        it('has mandatory id field', async () => {
            const response = await makeUpdateAgeRangesMutation([])
            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "id" of required type "ID!" was not provided.'
            )
        })
    })
})
