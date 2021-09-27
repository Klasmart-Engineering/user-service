import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRangeConnectionNode'
import { loadFixtures } from '../utils/fixtures'
import {
    createAgeRanges,
    createOrg,
    IAgeRangeDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { AGE_RANGES_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

interface IAgeRangeEdge {
    node: AgeRangeConnectionNode
}

let systemAgeRangesCount = 0
const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const ageRangesCount = 12

describe('acceptance.ageRange', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()
        await loadFixtures('users', connection)

        const ageRangeDetails: IAgeRangeDetail[] = []
        const createOrgResponse = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

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

        await createAgeRanges(orgId, ageRangeDetails, getAdminAuthToken())

        systemAgeRangesCount = await connection.manager.count(AgeRange, {
            where: { system: true },
        })
    })

    context('ageRangesConnection', () => {
        it('queries paginated age ranges', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: AGE_RANGES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

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
                    Authorization: getAdminAuthToken(),
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
                    Authorization: getAdminAuthToken(),
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
})
