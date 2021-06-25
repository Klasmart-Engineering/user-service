import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import GradesInitializer from '../../../src/initializers/grades'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { gradesConnection } from '../../utils/operations/modelOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
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
    let grades: Grade[] = []
    let systemGrades: Grade[] = []

    const gradesCount = 12

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await GradesInitializer.run()

        systemGrades = await Grade.find({
            where: { system: true, status: 'active' },
        })

        admin = await createAdminUser(testClient)
        org1 = await createOrganization(admin)
        org2 = await createOrganization(admin)
        await connection.manager.save([org1, org2])
        grades = []

        for (let i = 0; i < gradesCount; i++) {
            let grade = await createGrade(
                org1,
                systemGrades[i],
                systemGrades[i + 1]
            )
            grade.name = `grade ${i}`
            grade.status = Status.ACTIVE
            grades.push(grade)
        }

        for (let i = 0; i < gradesCount; i++) {
            let grade = await createGrade(
                org2,
                systemGrades[i],
                systemGrades[i + 1]
            )
            grade.name = `grade ${i}`
            grade.status = Status.INACTIVE
            grades.push(grade)
        }

        await connection.manager.save(grades)
    })

    context('pagination', () => {
        it('returns grades from all the list', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(10)
            expect(result.totalCount).to.eq(
                gradesCount * 2 + systemGrades.length
            )
        })
    })

    context('sorting', () => {
        it('returns grades sorted by id in an ascending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(
                gradesCount * 2 + systemGrades.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns grades sorted by id in a descending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(
                gradesCount * 2 + systemGrades.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns grades sorted by name in an ascending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(
                gradesCount * 2 + systemGrades.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns grades sorted by name in an descending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(
                gradesCount * 2 + systemGrades.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
        })
    })

    context('filtering', () => {
        it('supports filtering by organization ID', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org1.organization_id,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(gradesCount)
            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(10)
        })

        it('supports filtering by grade ID', async () => {
            const filter: IEntityFilter = {
                id: {
                    operator: 'eq',
                    value: grades[0].id,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)
        })

        it('supports filtering by grade name', async () => {
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: '8',
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(2)
        })

        it('supports filtering by grade status', async () => {
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: 'inactive',
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(gradesCount)
        })

        it('supports filtering by grade system', async () => {
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: true,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(systemGrades.length)
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
                gradesConnection(
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
