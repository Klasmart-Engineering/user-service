import { expect } from 'chai'
import { print } from 'graphql'
import supertest from 'supertest'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { Organization } from '../../src/entities/organization'
import { Program } from '../../src/entities/program'
import { User } from '../../src/entities/user'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRange'
import { ProgramConnectionNode } from '../../src/types/graphQL/program'
import { createGrade } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createProgram } from '../factories/program.factory'
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
import {
    CREATE_PROGRAMS,
    UPDATE_PROGRAMS,
    DELETE_PROGRAMS,
} from '../utils/operations/programOps'
import { userToPayload } from '../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { TestConnection } from '../utils/testConnection'
import { makeRequest } from './utils'
import { createUser as createUserFactory } from './../factories/user.factory'
import { createAgeRanges as createAgeRangesFactory } from './../factories/ageRange.factory'
import { createGrades as createGradesFactory } from './../factories/grade.factory'
import { createSubjects as createSubjectsFactory } from './../factories/subject.factory'
import { Grade } from '../../src/entities/grade'
import { Subject } from '../../src/entities/subject'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { getConnection } from 'typeorm'

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
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
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

        it('has gradesConnection as a child', async () => {
            const org = await Organization.findOne(orgId)
            const program = await createProgram(org).save()
            const programGrade = await createGrade(org).save()
            const otherProgramGrade = await createGrade(org).save()
            program.grades = Promise.resolve([programGrade])
            await program.save()

            const response = await makeRequest(
                request,
                PROGRAMS_CONNECTION,
                {
                    direction: 'FORWARD',
                    filterArgs: {
                        id: {
                            operator: 'eq',
                            value: program.id,
                        },
                    },
                },
                getAdminAuthToken()
            )
            const programsConnection = response.body.data.programsConnection
            expect(programsConnection.edges).to.have.lengthOf(1)
            expect(
                programsConnection.edges[0].node.gradesConnection.edges
            ).to.have.lengthOf(1)
            expect(
                programsConnection.edges[0].node.gradesConnection.edges[0].node
                    .id
            ).to.eq(programGrade.id)
        })
    })

    const createAgeRangeIds = async () =>
        (
            await AgeRange.save(
                createAgeRangesFactory(3, undefined, undefined, undefined, true)
            )
        ).map((ar) => ar.id)

    const createGradeIds = async () =>
        (
            await Grade.save(
                createGradesFactory(3, undefined, undefined, undefined, true)
            )
        ).map((g) => g.id)

    const createSubjectIds = async () =>
        (
            await Subject.save(
                createSubjectsFactory(3, undefined, undefined, true)
            )
        ).map((s) => s.id)

    context('createPrograms', () => {
        let adminUser: User
        let organization: Organization
        let ageRangeIds: string[]
        let gradeIds: string[]
        let subjectIds: string[]

        const makeCreateProgramsMutation = async (input: any, caller: User) => {
            return await makeRequest(
                request,
                print(CREATE_PROGRAMS),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            organization = await createOrganization().save()
            ageRangeIds = await createAgeRangeIds()
            gradeIds = await createGradeIds()
            subjectIds = await createSubjectIds()
            adminUser = await createUserFactory({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [
                    {
                        organizationId: organization.organization_id,
                        name: 'New Program',
                        ageRangeIds,
                        gradeIds,
                        subjectIds,
                    },
                ]
                const response = await makeCreateProgramsMutation(
                    input,
                    adminUser
                )

                const { programs } = response.body.data.createPrograms
                expect(response.status).to.eq(200)
                expect(programs).to.have.lengthOf(input.length)
            })
        })

        it('all the fields are mandatory', async () => {
            const response = await makeCreateProgramsMutation([{}], adminUser)

            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(5)

            expect(response.body.errors[0].message).to.contain(
                'Field "name" of required type "String!" was not provided.'
            )

            expect(response.body.errors[1].message).to.contain(
                'Field "organizationId" of required type "ID!" was not provided.'
            )

            expect(response.body.errors[2].message).to.contain(
                'Field "ageRangeIds" of required type "[ID!]!" was not provided.'
            )

            expect(response.body.errors[3].message).to.contain(
                'Field "gradeIds" of required type "[ID!]!" was not provided.'
            )

            expect(response.body.errors[4].message).to.contain(
                'Field "subjectIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('updatePrograms', () => {
        let adminUser: User
        let ageRangeIds: string[]
        let gradeIds: string[]
        let subjectIds: string[]
        let programToEdit: Program

        const makeUpdateProgramsMutation = async (input: any, caller: User) => {
            return await makeRequest(
                request,
                print(UPDATE_PROGRAMS),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            const org = await createOrganization().save()
            programToEdit = await createProgram(org).save()
            ageRangeIds = await createAgeRangeIds()
            gradeIds = await createGradeIds()
            subjectIds = await createSubjectIds()
            adminUser = await createUserFactory({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [
                    {
                        id: programToEdit.id,
                        name: 'New Name',
                        ageRangeIds,
                        gradeIds,
                        subjectIds,
                    },
                ]

                const response = await makeUpdateProgramsMutation(
                    input,
                    adminUser
                )

                const { programs } = response.body.data.updatePrograms
                expect(response.status).to.eq(200)
                expect(programs).to.have.lengthOf(input.length)
            })
        })

        it('has mandatory id field', async () => {
            const response = await makeUpdateProgramsMutation(
                [{ name: 'New Name', ageRangeIds, gradeIds, subjectIds }],
                adminUser
            )

            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "id" of required type "ID!" was not provided.'
            )
        })
    })

    context('deletePrograms', () => {
        let adminUser: User
        let programToDelete: Program

        const makeDeleteProgramsMutation = async (input: any, caller: User) => {
            return await makeRequest(
                request,
                print(DELETE_PROGRAMS),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            const org = await createOrganization().save()
            programToDelete = await createProgram(org).save()
            adminUser = await createUserFactory({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [{ id: programToDelete.id }]
                const response = await makeDeleteProgramsMutation(
                    input,
                    adminUser
                )

                const { programs } = response.body.data.deletePrograms
                expect(response.status).to.eq(200)
                expect(programs).to.have.lengthOf(input.length)
            })
        })

        it('has mandatory id field', async () => {
            const response = await makeDeleteProgramsMutation([{}], adminUser)
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
