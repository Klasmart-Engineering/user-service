import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createCategory } from '../../factories/category.factory'
import { createOrganization } from '../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { Category } from '../../../src/entities/category'
import { categoriesConnectionResolver } from '../../../src/pagination/categoriesConnection'
import { SelectQueryBuilder } from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'

use(chaiAsPromised)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1Categories: Category[] = []
    let org2Categories: Category[] = []
    let categories: Category[] = []
    let scope: SelectQueryBuilder<Category>
    let info: GraphQLResolveInfo
    let systemCategoriesCount = 0
    const ownedCategoriesCount = 10
    const pageSize = 10

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        scope = Category.createQueryBuilder('Category')
        info = ({
            fieldNodes: [
                {
                    selectionSet: {
                        selections: [
                            {
                                kind: 'Field',
                                name: {
                                    value: 'totalCount',
                                },
                            },
                        ],
                    },
                },
            ],
        } as unknown) as GraphQLResolveInfo
        systemCategoriesCount = await Category.count()

        admin = await createAdminUser(testClient)
        org1 = createOrganization(admin)
        org2 = createOrganization(admin)
        await connection.manager.save([org1, org2])
        org1Categories = []
        org2Categories = []
        categories = []

        for (let i = 0; i < ownedCategoriesCount / 2; i++) {
            const category = createCategory(org1)
            category.name = `category ${i}`
            category.status = Status.ACTIVE
            org1Categories.push(category)
        }

        for (let i = 0; i < ownedCategoriesCount / 2; i++) {
            const category = createCategory(org2)
            category.name = `category ${i}`
            category.status = Status.INACTIVE
            org2Categories.push(category)
        }

        categories.push(...org1Categories, ...org2Categories)
        await connection.manager.save(categories)
    })

    context('pagination', () => {
        it('returns categories from all the list', async () => {
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
            })

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(pageSize)
            expect(result.totalCount).to.eq(
                systemCategoriesCount + ownedCategoriesCount
            )
        })
    })

    context('sorting', () => {
        it('returns categories sorted by id in an ascending order', async () => {
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'id', order: 'ASC' },
            })

            expect(result.totalCount).to.eq(
                systemCategoriesCount + ownedCategoriesCount
            )
            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(pageSize)
            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)
            expect(isSorted).to.be.true
        })

        it('returns categories sorted by id in a descending order', async () => {
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'id', order: 'DESC' },
            })

            expect(result.totalCount).to.eq(
                systemCategoriesCount + ownedCategoriesCount
            )
            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(pageSize)
            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)
            expect(isSorted).to.be.true
        })

        it('returns categories sorted by name in an ascending order', async () => {
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'name', order: 'ASC' },
            })

            expect(result.totalCount).to.eq(
                systemCategoriesCount + ownedCategoriesCount
            )
            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(pageSize)
            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedAscending(names)
            expect(isSorted).to.be.true
        })

        it('returns categories sorted by name in an descending order', async () => {
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'name', order: 'DESC' },
            })
            expect(result.totalCount).to.eq(
                systemCategoriesCount + ownedCategoriesCount
            )
            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(pageSize)
            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedDescending(names)
            expect(isSorted).to.be.true
        })
    })

    context('filtering', () => {
        it('supports filtering by status', async () => {
            const filterStatus = 'inactive'
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }
            const inactiveCategoriesCount = await connection.manager.count(
                Category,
                {
                    where: { status: 'inactive' },
                }
            )
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })
            expect(result.totalCount).to.eq(inactiveCategoriesCount)
            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by category system', async () => {
            const activeSystemCategories = await Category.find({
                where: { system: true, status: 'active' },
            })
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }
            const result = await categoriesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })
            expect(result.totalCount).to.eq(activeSystemCategories.length)
            const systems = result.edges.map((edge) => edge.node.system)
            systems.every((system) => system === filterSystem)
        })
    })
})
