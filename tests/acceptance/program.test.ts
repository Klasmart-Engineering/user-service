import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { Program } from '../../src/entities/program'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRange'
import { ProgramConnectionNode } from '../../src/types/graphQL/program'
import { loadFixtures } from '../utils/fixtures'
import {
    addProgramsToClass,
    createAgeRanges,
    createClass,
    createOrg,
    createPrograms,
    IAgeRangeDetail,
    IProgramDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { PROGRAMS_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

interface IProgramEdge {
    node: ProgramConnectionNode
}

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const programsCount = 12
const ageRangesCount = 6
const classesCount = 2

let classIds: string[] = []
let orgId: string

describe('acceptance.program', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        classIds = []

        await AgeRangesInitializer.run()
        await loadFixtures('users', connection)

        const ageRangeDetails: IAgeRangeDetail[] = []
        const programDetails: IProgramDetail[] = []

        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        orgId = createOrg1Data.organization_id

        for (let i = 0; i < ageRangesCount; i++) {
            const unit = i % 2 === 0 ? AgeRangeUnit.YEAR : AgeRangeUnit.MONTH
            ageRangeDetails.push({
                name: `Age Range ${i + 1}`,
                low_value: i + 1,
                low_value_unit: unit,
                high_value: i + 2,
                high_value_unit: unit,
            })
        }

        await createAgeRanges(orgId, ageRangeDetails, getAdminAuthToken())

        const ageRanges =
            (await connection.manager.find(AgeRange, {
                where: { system: false },
            })) || []

        const ageRangeIds = ageRanges.map((ar) => ar.id)

        for (let i = 0; i < programsCount; i++) {
            const index = i >= ageRangesCount ? i % ageRangesCount : i
            programDetails.push({
                name: `Age Range ${i + 1}`,
                age_ranges: [ageRangeIds[index]],
            })
        }

        const programsResponse = await createPrograms(
            orgId,
            programDetails,
            getAdminAuthToken()
        )

        const programs =
            programsResponse.body.data.organization.createOrUpdatePrograms
        const programIds = programs.map((p: Program) => p.id)

        for (let i = 0; i < classesCount; i++) {
            const classResponse = await createClass(
                orgId,
                `class ${i + 1}`,
                getAdminAuthToken()
            )

            const classId =
                classResponse.body.data.organization.createClass.class_id
            classIds.push(classId)
        }

        for (const classId of classIds) {
            const ids = [programIds[0], programIds[1], programIds[2]]

            await addProgramsToClass(classId, ids, getAdminAuthToken())
        }
    })

    context('programsConnection', () => {
        context('using explict count', async () => {
            async function makeQuery(pageSize: any) {
                return await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: PROGRAMS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            directionArgs: {
                                count: pageSize,
                            },
                        },
                    })
            }

            it('passes validation', async () => {
                const pageSize = 5

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(200)
                const programsConnection = response.body.data.programsConnection
                expect(programsConnection.edges.length).to.equal(pageSize)
            })

            it('fails validation', async () => {
                const pageSize = 'not_a_number'

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(400)
                expect(response.body.errors.length).to.equal(1)
                const message = response.body.errors[0].message
                expect(message)
                    .to.be.a('string')
                    .and.satisfy((msg: string) =>
                        msg.startsWith(
                            'Variable "$directionArgs" got invalid value "not_a_number" at "directionArgs.count"; Expected type "PageSize".'
                        )
                    )
            })
        })
        it('queries paginated programs without filter', async () => {
            const response = await request
                .post('/user')
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
                value: 4,
                unit: AgeRangeUnit.MONTH,
            }

            const response = await request
                .post('/user')
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
            expect(programsConnection.totalCount).to.equal(2)

            const ageRangesValues = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                    )
                }
            )

            const ageRangesUnits = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) =>
                            ageRange.lowValueUnit
                    )
                }
            )

            ageRangesValues.every((values: number[]) =>
                values?.includes(ageRangeValue.value)
            )

            ageRangesUnits.every((units: AgeRangeUnit[]) =>
                units?.includes(ageRangeValue.unit)
            )
        })

        it('queries paginated programs filtering by age range to', async () => {
            const ageRangeValue = {
                value: 4,
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/user')
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
            expect(programsConnection.totalCount).to.equal(2)

            const ageRangesValues = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                    )
                }
            )

            const ageRangesUnits = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) =>
                            ageRange.lowValueUnit
                    )
                }
            )

            ageRangesValues.every((values: number[]) =>
                values?.includes(ageRangeValue.value)
            )

            ageRangesUnits.every((units: AgeRangeUnit[]) =>
                units?.includes(ageRangeValue.unit)
            )
        })

        it('queries paginated programs filtering by class ID', async () => {
            const classId = classIds[0]
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            classId: {
                                operator: 'eq',
                                value: classId,
                            },
                        },
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(3)
        })

        it('responds with an error if the filter is wrong', async () => {
            const ageRangeValue = {
                value: 'six',
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/user')
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
