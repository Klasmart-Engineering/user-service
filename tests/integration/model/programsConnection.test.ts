import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { AgeRange } from '../../../src/entities/ageRange'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Status } from '../../../src/entities/status'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import { createSubject } from '../../factories/subject.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { programsConnection } from '../../utils/operations/modelOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

use(chaiAsPromised)

describe('model', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    let admin: User
    let org1: Organization
    let org2: Organization
    let programs: Program[] = []
    let ageRanges: AgeRange[] = []
    let grades: Grade[] = []
    let subjects: Subject[] = []
    const programsCount = 12
    const ageRangesCount = 6
    const gradesCount = 4
    const subjectsCount = 3

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        admin = await createAdminUser(testClient)
        org1 = await createOrganization(admin)
        org2 = await createOrganization(admin)
        await connection.manager.save([org1, org2])

        programs = []
        ageRanges = []
        grades = []
        subjects = []

        for (let i = 0; i < ageRangesCount; i++) {
            let ageRange = await createAgeRange(org1)
            ageRanges.push(ageRange)
        }

        await connection.manager.save(ageRanges)

        for (let i = 0; i < gradesCount; i++) {
            let grade = await createGrade(org1)
            grades.push(grade)
        }

        await connection.manager.save(grades)

        for (let i = 0; i < subjectsCount; i++) {
            let subject = await createSubject(org1)
            subjects.push(subject)
        }

        await connection.manager.save(subjects)

        for (let i = 0; i < programsCount; i++) {
            let program = await createProgram(org1)
            program.name = `program ${i}`
            program.age_ranges = Promise.resolve([
                ageRanges[Math.floor(i / (programsCount / ageRangesCount))],
            ])
            program.grades = Promise.resolve([
                grades[Math.floor(i / (programsCount / gradesCount))],
            ])
            program.subjects = Promise.resolve([
                subjects[Math.floor(i / (programsCount / subjectsCount))],
            ])
            program.status = Status.ACTIVE
            programs.push(program)
        }

        for (let i = 0; i < programsCount; i++) {
            let program = await createProgram(org2)
            program.name = `program ${i}`
            program.status = Status.INACTIVE
            programs.push(program)
        }

        await connection.manager.save(programs)
    })

    context('unfiltered', () => {
        it('returns all programs', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(programsCount * 2)
        })
    })

    context('filtered', () => {
        it('supports filtering by organizationId', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',

                    value: org1.organization_id,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount)
        })

        it('supports filtering by program ID', async () => {
            const filter: IEntityFilter = {
                programId: {
                    operator: 'eq',
                    value: programs[0].id,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)
        })

        it('supports filtering by program name', async () => {
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: '1',
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(result.totalCount).to.eq(6)
        })

        it('supports filtering by program status', async () => {
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: 'inactive',
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount)
        })

        it('supports filtering by age range ID', async () => {
            const filter: IEntityFilter = {
                ageRangeId: {
                    operator: 'eq',
                    value: ageRanges[0].id,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / ageRangesCount)
        })

        it('supports filtering by grade ID', async () => {
            const filter: IEntityFilter = {
                gradeId: {
                    operator: 'eq',
                    value: grades[0].id,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / gradesCount)
        })

        it('supports filtering by subject ID', async () => {
            const filter: IEntityFilter = {
                subjectId: {
                    operator: 'eq',
                    value: subjects[0].id,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / subjectsCount)
        })
    })
})
