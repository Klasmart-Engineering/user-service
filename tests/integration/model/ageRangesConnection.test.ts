import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm/connection/Connection'
import { AgeRange } from '../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import AgeRangesInitializer from '../../../src/initializers/ageRanges'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createOrganization } from '../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { ageRangesConnection } from '../../utils/operations/modelOps'
import {
    isNumberArraySortedAscending,
    isNumberArraySortedDescending,
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
    let org1AgeRanges: AgeRange[] = []
    let org2AgeRanges: AgeRange[] = []
    let ageRanges: AgeRange[] = []
    let systemAgeRanges: AgeRange[] = []

    const ageRangesCount = 12

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()

        systemAgeRanges = await AgeRange.find({
            where: { system: true, status: 'active' },
        })

        admin = await createAdminUser(testClient)
        org1 = await createOrganization({}, admin )
        org2 = await createOrganization({}, admin )
        await connection.manager.save([org1, org2])

        org1AgeRanges = []
        org2AgeRanges = []
        ageRanges = []

        for (let i = 0; i < ageRangesCount; i++) {
            let ageRange = await createAgeRange(org1, i, i + 1)
            ageRange.name = `age range ${i}`
            ageRange.status = Status.ACTIVE
            org1AgeRanges.push(ageRange)
        }

        for (let i = 0; i < ageRangesCount; i++) {
            let ageRange = await createAgeRange(
                org2,
                ageRangesCount + i,
                ageRangesCount + i + 1
            )
            ageRange.name = `program ${i}`
            ageRange.status = Status.INACTIVE
            org2AgeRanges.push(ageRange)
        }

        ageRanges.push(...org1AgeRanges, ...org2AgeRanges)

        await connection.manager.save(ageRanges)
    })

    context('pagination', () => {
        it('returns age ranges from all the list', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(
                ageRanges.length + systemAgeRanges.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })
    })

    context('sorting', () => {
        it('returns age ranges sorted by id in an ascending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(
                ageRanges.length + systemAgeRanges.length
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

        it('returns age ranges sorted by id in a descending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(
                ageRanges.length + systemAgeRanges.length
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

        it('returns age ranges sorted by age range (low value unit, low value) in an ascending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: ['lowValueUnit', 'lowValue'], order: 'ASC' }
            )

            expect(result.totalCount).to.eq(
                ageRanges.length + systemAgeRanges.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const units = result.edges.map((edge) => edge.node.lowValueUnit)
            const monthValues = result.edges
                .filter((edge) => edge.node.lowValueUnit === AgeRangeUnit.MONTH)
                .map((edge) => edge.node.lowValue)
            const yearValues = result.edges
                .filter((edge) => edge.node.lowValueUnit === AgeRangeUnit.YEAR)
                .map((edge) => edge.node.lowValue)

            const isUnitsSorted = isStringArraySortedAscending(units)
            const isYearValuesSorted = isNumberArraySortedAscending(yearValues)
            const isMonthValuesSorted = isNumberArraySortedAscending(
                monthValues
            )

            expect(isUnitsSorted).to.be.true
            expect(isMonthValuesSorted).to.be.true
            expect(isYearValuesSorted).to.be.true
        })

        it('returns age ranges sorted by age range (low value unit, low value) in a descending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: ['lowValueUnit', 'lowValue'], order: 'DESC' }
            )

            expect(result.totalCount).to.eq(
                ageRanges.length + systemAgeRanges.length
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const units = result.edges.map((edge) => edge.node.lowValueUnit)
            const monthValues = result.edges
                .filter((edge) => edge.node.lowValueUnit === AgeRangeUnit.MONTH)
                .map((edge) => edge.node.lowValue)
            const yearValues = result.edges
                .filter((edge) => edge.node.lowValueUnit === AgeRangeUnit.YEAR)
                .map((edge) => edge.node.lowValue)

            const isUnitsSorted = isStringArraySortedDescending(units)
            const isYearValuesSorted = isNumberArraySortedDescending(yearValues)
            const isMonthValuesSorted = isNumberArraySortedDescending(
                monthValues
            )

            expect(isUnitsSorted).to.be.true
            expect(isMonthValuesSorted).to.be.true
            expect(isYearValuesSorted).to.be.true
        })
    })

    context('filtering', () => {
        it('supports filtering by organization ID', async () => {
            const organizationId = org1.organization_id
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: organizationId,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(org1AgeRanges.length)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ageRangeIds = result.edges.map((edge) => edge.node.id)
            const org1AgeRangeIds = org1AgeRanges.map((ageRange) => ageRange.id)
            ageRangeIds.every((id) => org1AgeRangeIds.includes(id))
        })

        it('supports filtering by age range status', async () => {
            const filterStatus = 'inactive'
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(ageRangesCount)

            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by age range system', async () => {
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(systemAgeRanges.length)

            const systems = result.edges.map((edge) => edge.node.system)
            systems.every((system) => system === filterSystem)
        })
    })
})
