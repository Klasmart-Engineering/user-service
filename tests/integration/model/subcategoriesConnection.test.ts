import { expect, use } from 'chai'
import { Category } from '../../../src/entities/category'
import { Organization } from '../../../src/entities/organization'
import { Role } from '../../../src/entities/role'
import { Status } from '../../../src/entities/status'
import { Subcategory } from '../../../src/entities/subcategory'
import { User } from '../../../src/entities/user'
import SubcategoriesInitializer from '../../../src/initializers/subcategories'
import CategoriesInitializer from '../../../src/initializers/categories'
import { Model } from '../../../src/model'
import { SubcategoryConnectionNode } from '../../../src/types/graphQL/subcategory'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createCategory } from '../../factories/category.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSubcategory } from '../../factories/subcategory.factory'
import { createAdminUser, createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { userToPayload } from '../../utils/operations/userOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { GraphQLResolveInfo } from 'graphql'
import { Context } from '../../../src/main'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { SelectQueryBuilder } from 'typeorm'
import { nonAdminSubcategoryScope } from '../../../src/directives/isAdmin'
import { subcategoriesConnectionResolver } from '../../../src/pagination/subcategoriesConnection'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import {
    loadSubcategoriesForCategory,
    subcategoriesConnectionResolver as resolverForCategory,
} from '../../../src/schemas/category'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import {
    loadSubcategoriesForOrganization,
    subcategoriesConnectionResolver as resolverForOrganization,
} from '../../../src/schemas/organization'

type SubcategoryConnectionNodeKey = keyof SubcategoryConnectionNode

use(deepEqualInAnyOrder)

describe('subcategoriesConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminUser: User
    let organizationMember1: User
    let organizationMember2: User
    let noMemberUser: User
    let organization1: Organization
    let organization2: Organization
    let subcategories1: Subcategory[]
    let subcategories2: Subcategory[]
    let categories1: Category[]
    let subcategoriesCount: number
    let systemSubcategoriesCount: number
    let scope: SelectQueryBuilder<Subcategory>
    let adminPermissions: UserPermissions
    let memberPermissions: UserPermissions
    let noMemberPermissions: UserPermissions

    const pageSize = 10
    const orgSubcategoriesCount = 6
    const orgCategoriesCount = 2

    // emulated info object to could test resolver
    let info: GraphQLResolveInfo

    // emulated ctx object to could test resolver
    let ctx: Context

    const expectSorting = async (
        field: SubcategoryConnectionNodeKey,
        order: 'ASC' | 'DESC'
    ) => {
        const result = await subcategoriesConnectionResolver(info, ctx, {
            direction: 'FORWARD',
            directionArgs: { count: pageSize },
            scope,
            sort: { field, order },
        })

        expect(result.totalCount).to.eql(subcategoriesCount)
        expect(result.edges.length).eq(pageSize)

        const values = result.edges.map((edge) => edge.node[field]) as string[]
        const isSorted =
            order === 'ASC'
                ? isStringArraySortedAscending(values)
                : isStringArraySortedDescending(values)

        expect(isSorted).to.be.true
    }

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        if (!permissions.isAdmin) {
            await nonAdminSubcategoryScope(scope, permissions)
        }

        ctx = ({
            permissions,
        } as unknown) as Context
    }

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        scope = Subcategory.createQueryBuilder('Subcategory')
        await SubcategoriesInitializer.run()
        await CategoriesInitializer.run()

        const teacherRole = await Role.findOneOrFail({
            where: { system_role: true, role_name: 'Teacher' },
        })

        const orgAdminRole = await Role.findOneOrFail({
            where: { system_role: true, role_name: 'Organization Admin' },
        })

        subcategories1 = []
        subcategories2 = []
        categories1 = []

        adminUser = await createAdminUser().save()
        organizationMember1 = await createUser().save()
        organizationMember2 = await createUser().save()
        noMemberUser = await createUser().save()
        organization1 = await createOrganization().save()
        organization2 = await createOrganization().save()

        for (let i = 0; i < orgSubcategoriesCount; i += 1) {
            subcategories1.push(createSubcategory(organization1))
            subcategories2.push(createSubcategory(organization2))
        }

        await connection.manager.save([...subcategories1, ...subcategories2])

        for (let i = 0; i < orgCategoriesCount; i += 1) {
            const index = i * 3
            categories1.push(
                createCategory(organization1, [
                    subcategories1[index],
                    subcategories1[index + 1],
                    subcategories1[index + 2],
                ])
            )
        }

        await connection.manager.save(categories1)

        // adding organizationMember1 to organization1 with orgAdminRole
        await createOrganizationMembership({
            user: organizationMember1,
            organization: organization1,
            roles: [orgAdminRole],
        }).save()

        // adding organizationMember1 to organization2 with teacherRole
        await createOrganizationMembership({
            user: organizationMember2,
            organization: organization2,
            roles: [teacherRole],
        }).save()

        systemSubcategoriesCount = await Subcategory.count({
            where: { system: true },
        })

        subcategoriesCount =
            systemSubcategoriesCount + orgSubcategoriesCount * 2

        adminPermissions = new UserPermissions(userToPayload(adminUser))
        memberPermissions = new UserPermissions(
            userToPayload(organizationMember1)
        )
        noMemberPermissions = new UserPermissions(userToPayload(noMemberUser))

        // Emulating graphql objects
        await buildScopeAndContext(adminPermissions)

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
    })

    context('data', () => {
        it('returns subcategories from all the list with its corresponding data', async () => {
            const result = await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
            })

            expect(result.totalCount).to.eql(subcategoriesCount)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(pageSize)
        })
    })

    context('sorting', () => {
        it("returns subcategories sorted by 'id' in an ASCENDING order", async () => {
            await expectSorting('id', 'ASC')
        })

        it("returns permissions sorted by 'id' in a DESCENDING order", async () => {
            await expectSorting('id', 'DESC')
        })

        it("returns permissions sorted by 'name' in an ASCENDING order", async () => {
            await expectSorting('name', 'ASC')
        })

        it("returns permissions sorted by 'name' in a DESCENDING order", async () => {
            await expectSorting('name', 'DESC')
        })
    })

    context('filtering', () => {
        beforeEach(async () => {
            const inactiveSubcategory = await Subcategory.findOneOrFail()
            inactiveSubcategory.status = Status.INACTIVE
            await connection.manager.save(inactiveSubcategory)
        })

        it('supports filtering by subcategory status', async () => {
            const status = Status.INACTIVE
            const filter: IEntityFilter = {
                status: { operator: 'eq', value: status },
            }

            const result = await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eql(1)

            result.edges.forEach((edge) => {
                expect(edge.node.status).to.eql(status)
            })
        })

        it('supports filtering by subcategory system', async () => {
            const system = false
            const filter: IEntityFilter = {
                system: { operator: 'eq', value: system },
            }

            const result = await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eql(orgSubcategoriesCount * 2)

            result.edges.forEach((edge) => {
                expect(edge.node.system).to.eql(system)
            })
        })

        it('supports filtering by organization ID', async () => {
            const organizationId = organization1.organization_id
            const filter: IEntityFilter = {
                organizationId: { operator: 'eq', value: organizationId },
            }

            const result = await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eql(orgSubcategoriesCount)

            subcategories1.sort((a, b) => {
                if (a.id < b.id) {
                    return -1
                }

                if (a.id > b.id) {
                    return 1
                }

                return 0
            })

            result.edges.forEach((edge, i) => {
                expect(edge.node.id).to.eql(subcategories1[i].id)
                expect(edge.node.name).to.eql(subcategories1[i].name)
                expect(edge.node.status).to.eql(subcategories1[i].status)
                expect(edge.node.system).to.eql(subcategories1[i].system)
            })
        })

        it('supports filtering by category ID', async () => {
            const categoryId = categories1[0].id
            const filter: IEntityFilter = {
                categoryId: { operator: 'eq', value: categoryId },
            }

            const result = await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eql(
                orgSubcategoriesCount / orgCategoriesCount
            )

            const categorySubcategories =
                (await categories1[0].subcategories) || []

            categorySubcategories.sort((a, b) => {
                if (a.id < b.id) {
                    return -1
                }

                if (a.id > b.id) {
                    return 1
                }

                return 0
            })

            result.edges.forEach((edge, i) => {
                expect(edge.node.id).to.eql(categorySubcategories[i].id)
                expect(edge.node.name).to.eql(categorySubcategories[i].name)
                expect(edge.node.status).to.eql(categorySubcategories[i].status)
                expect(edge.node.system).to.eql(categorySubcategories[i].system)
            })
        })
    })

    context('when totalCount is not requested', () => {
        beforeEach(() => {
            info = ({
                fieldNodes: [
                    {
                        selectionSet: {
                            selections: [
                                {
                                    kind: 'Field',

                                    name: {
                                        value: 'edges',
                                    },
                                },
                            ],
                        },
                    },
                ],
            } as unknown) as GraphQLResolveInfo
        })

        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
            })

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('permissions', () => {
        let aliases: string[]
        let conditions: string[]

        context('when user is super admin', () => {
            it('should have access to any subcategory', async () => {
                aliases = scope.expressionMap.aliases.map((a) => a.name)
                conditions = scope.expressionMap.wheres.map((w) => w.condition)

                expect(aliases.length).to.eq(1)
                expect(aliases).to.deep.equalInAnyOrder(['Subcategory'])
                expect(conditions.length).to.eq(0)
            })
        })

        context('when user is organization member', () => {
            it('should have access to system and own subcategories', async () => {
                await buildScopeAndContext(memberPermissions)
                aliases = scope.expressionMap.aliases.map((a) => a.name)
                conditions = scope.expressionMap.wheres.map((w) => w.condition)

                expect(aliases.length).to.eq(2)
                expect(aliases).to.deep.equalInAnyOrder([
                    'Subcategory',
                    'OrganizationMembership',
                ])

                expect(conditions.length).to.eq(1)
                expect(conditions).to.deep.equalInAnyOrder([
                    '(OrganizationMembership.user_id = :d_user_id OR Subcategory.system = :system)',
                ])
            })
        })

        context('when user has not any memebership', () => {
            it('should have access just to system subcategories', async () => {
                await buildScopeAndContext(noMemberPermissions)
                aliases = scope.expressionMap.aliases.map((a) => a.name)
                conditions = scope.expressionMap.wheres.map((w) => w.condition)

                expect(aliases.length).to.eq(2)
                expect(aliases).to.deep.equalInAnyOrder([
                    'Subcategory',
                    'OrganizationMembership',
                ])

                expect(conditions.length).to.eq(1)
                expect(conditions).to.deep.equalInAnyOrder([
                    '(OrganizationMembership.user_id = :d_user_id OR Subcategory.system = :system)',
                ])
            })
        })
    })

    context('subcategoriesConnectionChild', () => {
        let ctx: Pick<Context, 'loaders'>
        let fakeInfo: any

        beforeEach(async () => {
            // clientUser = await createUser().save()

            const token = { id: organizationMember1.user_id }
            const permissions = new UserPermissions(token)
            ctx = { loaders: createContextLazyLoaders(permissions) }
            fakeInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'organizationMembershipsConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        context('as child of an organization', () => {
            it('returns subcategories per organization', async () => {
                const result = await loadSubcategoriesForOrganization(
                    ctx,
                    organization1.organization_id
                )
                expect(result.edges).to.have.lengthOf(subcategories1.length)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    subcategories1.map((m) => m.id)
                )
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForOrganization(
                    { id: organization1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(subcategories1.length)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForOrganization(
                    { id: organization1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        context('as child of a subcategory', () => {
            it('returns subcategories per category', async () => {
                const result = await loadSubcategoriesForCategory(
                    ctx,
                    categories1[0].id
                )
                expect(result.edges).to.have.lengthOf(3)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    [
                        subcategories1[0],
                        subcategories1[1],
                        subcategories1[2],
                    ].map((m) => m.id)
                )
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForCategory(
                    { id: categories1[0].id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(3)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForCategory(
                    { id: categories1[0].id },
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
            for (const category of categories1) {
                loaderResults.push(
                    loadSubcategoriesForCategory(ctx, category.id, {}, false)
                )
            }
            await Promise.all(loaderResults)

            expect(connection.logger.count).to.be.eq(1)
        })
        context('sorting', () => {
            let category1Subcategories: Subcategory[]
            beforeEach(() => {
                category1Subcategories = subcategories1.slice(0, 2)
            })
            it('sorts by id', async () => {
                const result = await loadSubcategoriesForCategory(
                    ctx,
                    categories1[0].id,
                    {
                        sort: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = [
                    subcategories1[0],
                    subcategories1[1],
                    subcategories1[2],
                ]
                    .map((m) => m.id)
                    .sort()
                expect(result.edges.map((e) => e.node.id)).to.deep.equal(sorted)
            })
            it('sorts by name', async () => {
                const result = await loadSubcategoriesForCategory(
                    ctx,
                    categories1[0].id,
                    {
                        sort: {
                            field: 'name',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = [
                    subcategories1[0],
                    subcategories1[1],
                    subcategories1[2],
                ]
                    .map((m) => m.name)
                    .sort(function (a, b) {
                        return (a as String).localeCompare(b as string)
                    })
                expect(result.edges.map((e) => e.node.name)).to.deep.equal(
                    sorted
                )
            })
        })
        context('totalCount', () => {
            it('returns total count', async () => {
                const result = await loadSubcategoriesForCategory(
                    ctx,
                    categories1[0].id,
                    {},
                    true
                )
                expect(result.totalCount).to.eq(3)
            })
            it('does not return total count', async () => {
                const result = await loadSubcategoriesForCategory(
                    ctx,
                    categories1[0].id,
                    {},
                    false
                )
                expect(result.totalCount).to.not.exist
            })
        })
    })
})
