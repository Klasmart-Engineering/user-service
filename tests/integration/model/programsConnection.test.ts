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
import { createAgeRange } from '../../factories/ageRange.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import { createSubject } from '../../factories/subject.factory'
import { programsConnection } from '../../utils/operations/modelOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'

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
            program.system = i % 2 === 0
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

    context('pagination', () => {
        it('returns programs from all the list', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })
    })

    context('sorting', () => {
        it('returns programs sorted by id in an ascending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns programs sorted by id in a descending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns programs sorted by name in an ascending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name)
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns programs sorted by name in a descending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name)
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
        })
    })

    context('filtering', () => {
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

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })

        it('supports filtering by program ID', async () => {
            const filter: IEntityFilter = {
                id: {
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

        it('supports filtering by program system', async () => {
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: true,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / 2)
        })

        it('fails if search value is longer than 250 characters', async () => {
            const longValue =
                'hOfLDx5hwPm1KnwNEaAHUddKjN62yGEk4ZycRB7UjmZXMtm2ODnQCycCmylMDsVDCztWgrepOaQ9itKx94g2rELPj8w533bGpKqUT9a25NuKrzs5R3OfTUprOkCLE1PBHYOAUpSU289e4BhZzR40ncGsKwKtIFHQ9fzy1hlPr3gWMK8H6s5JGtO0oQrl8Lf0co5IlKWRaeEY4eaUUIWVHRiSdsaaXgM5ffW1zgZCrhOYCPZrBrP8uYaiPGsn1GjE8Chf'
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: longValue,
                },
            }

            const fn = () =>
                programsConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )

            expect(fn()).to.be.rejected
        })
    })
})
