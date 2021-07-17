import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import ProgramsInitializer from '../../src/initializers/programs'
import { AgeRangeSummaryNode } from '../../src/types/graphQL/ageRangeSummaryNode'
import { ProgramConnectionNode } from '../../src/types/graphQL/programConnectionNode'
import { loadFixtures } from '../utils/fixtures'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

interface IProgramEdge {
    node: ProgramConnectionNode
}

const url = 'http://localhost:8080'
const request = supertest(url)

const PROGRAMS_CONNECTION = `
    query programsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: ProgramFilter, $sortArgs: ProgramSortInput) {
        programsConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    status
                    system

                    ageRanges {
                        id
                        name
                        lowValue
                        lowValueUnit
                        highValue
                        highValueUnit
                        system
                        status
                    }

                    grades {
                        id
                        name
                        status
                        system
                    }

                    subjects {
                        id
                        name
                        status
                        system
                    }
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

describe('acceptance.program', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
        await loadFixtures('users', connection)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()
        await ProgramsInitializer.run()
    })

    context('programsConnection', () => {
        it('queries paginated programs without filter', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(12)
        })

        it('queries paginated programs filtering by age range from', async () => {
            const ageRangeValue = {
                value: 6,
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeFrom: {
                                operator: 'eq',
                                value: ageRangeValue,
                            },
                        },
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(6)

            const ageRangesValues = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeSummaryNode) => ageRange.lowValue
                    )
                }
            )

            const ageRangesUnits = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeSummaryNode) => ageRange.lowValueUnit
                    )
                }
            )

            ageRangesValues.every((values: Number[]) =>
                values?.includes(ageRangeValue.value)
            )

            ageRangesUnits.every((units: AgeRangeUnit[]) =>
                units?.includes(ageRangeValue.unit)
            )
        })

        it('queries paginated programs filtering by age range to', async () => {
            const ageRangeValue = {
                value: 6,
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeTo: {
                                operator: 'eq',
                                value: ageRangeValue,
                            },
                        },
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(11)

            const ageRangesValues = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeSummaryNode) => ageRange.lowValue
                    )
                }
            )

            const ageRangesUnits = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeSummaryNode) => ageRange.lowValueUnit
                    )
                }
            )

            ageRangesValues.every((values: Number[]) =>
                values?.includes(ageRangeValue.value)
            )

            ageRangesUnits.every((units: AgeRangeUnit[]) =>
                units?.includes(ageRangeValue.unit)
            )
        })

        it('responds with an error if the filter is wrong', async () => {
            const ageRangeValue = {
                value: 'six',
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeTo: {
                                operator: 'eq',
                                value: ageRangeValue,
                            },
                        },
                    },
                })

            expect(response.status).to.eq(400)
            expect(response.body).to.have.property('errors')
        })
    })
})
