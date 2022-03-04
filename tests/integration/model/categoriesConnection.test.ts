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
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { Category } from '../../../src/entities/category'
import { categoriesConnectionResolver } from '../../../src/pagination/categoriesConnection'
import { SelectQueryBuilder, getConnection } from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { Context } from '../../../src/main'
import { createUser } from '../../factories/user.factory'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import {
    loadCategoriesForOrganization,
    categoriesConnectionResolver as resolverForOrganization,
} from '../../../src/schemas/organization'
import { createSubject } from '../../factories/subject.factory'
import { Subject } from '../../../src/entities/subject'
import {
    loadCategoriesForSubject,
    categoriesConnectionResolver as resolverForSubject,
} from '../../../src/schemas/subject'

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
    let systemCategories: Category[]
    let systemCategoriesCount = 0
    const ownedCategoriesCount = 10
    const pageSize = 10

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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

        systemCategories = await Category.find({
            where: {
                system: true,
            },
        })
        systemCategoriesCount = systemCategories.length

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

            expect(result.pageInfo.hasNextPage).to.be.false
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

    context('categoriesConnectionChild', () => {
        let ctx: Pick<Context, 'loaders'>
        let fakeInfo: any
        let organizationMember1: User
        let subject: Subject
        let subject2: Subject

        beforeEach(async () => {
            organizationMember1 = await createUser().save()
            await createOrganizationMembership({
                user: organizationMember1,
                organization: org1,
            }).save()
            const token = { id: organizationMember1.user_id }
            const permissions = new UserPermissions(token)
            ctx = { loaders: createContextLazyLoaders(permissions) }
            fakeInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'categoriesConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }

            subject = await createSubject(org1, org1Categories).save()
            subject2 = await createSubject(org1, org1Categories).save()
        })

        context('as child of an organization', () => {
            it('returns categories per organization and system categories', async () => {
                const result = await loadCategoriesForOrganization(
                    ctx,
                    org1.organization_id
                )
                expect(result.totalCount).to.eq(
                    org1Categories.length + systemCategoriesCount
                )
                expect(
                    org1Categories.concat(systemCategories).map((m) => m.id)
                ).include.members(result.edges.map((e) => e.node.id))
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForOrganization(
                    { id: org1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(org1Categories.length)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForOrganization(
                    { id: org1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        context('as child of a subject', () => {
            it('returns categories per subject', async () => {
                const result = await loadCategoriesForSubject(ctx, subject.id)
                expect(result.edges).to.have.lengthOf(org1Categories.length)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    org1Categories.map((m) => m.id)
                )
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForSubject(
                    { id: subject.id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(org1Categories.length)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForSubject(
                    { id: subject.id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        it('uses exactly one dataloader when called with different parent', async () => {
            connection.logger.reset()
            const loaderResults = []
            for (const subj of [subject, subject2]) {
                loaderResults.push(
                    loadCategoriesForSubject(ctx, subj.id, {}, false)
                )
            }
            await Promise.all(loaderResults)

            expect(connection.logger.count).to.be.eq(1)
        })
        context('sorting', () => {
            let subjectCategories: Category[]
            beforeEach(() => {
                subjectCategories = org1Categories.slice(0, 2)
            })
            it('sorts by id', async () => {
                const result = await loadCategoriesForSubject(
                    ctx,
                    subject.id,
                    {
                        sort: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = org1Categories.map((m) => m.id).sort()
                expect(result.edges.map((e) => e.node.id)).to.deep.equal(sorted)
            })
            it('sorts by name', async () => {
                const result = await loadCategoriesForSubject(
                    ctx,
                    subject.id,
                    {
                        sort: {
                            field: 'name',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = org1Categories
                    .map((m) => m.name)
                    .sort(function (a, b) {
                        return (a as string).localeCompare(b as string)
                    })
                expect(result.edges.map((e) => e.node.name)).to.deep.equal(
                    sorted
                )
            })
        })
        context('totalCount', () => {
            it('returns total count', async () => {
                const result = await loadCategoriesForSubject(
                    ctx,
                    subject.id,
                    {},
                    true
                )
                expect(result.totalCount).to.eq(org1Categories.length)
            })
            it('does not return total count', async () => {
                const result = await loadCategoriesForSubject(
                    ctx,
                    subject.id,
                    {},
                    false
                )
                expect(result.totalCount).to.not.exist
            })
        })
    })
})
