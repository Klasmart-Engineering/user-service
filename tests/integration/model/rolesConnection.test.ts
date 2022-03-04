import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Role } from '../../../src/entities/role'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createRole } from '../../factories/role.factory'
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
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { GraphQLResolveInfo } from 'graphql'
import { getRepository, SelectQueryBuilder, getConnection } from 'typeorm'
import { rolesConnectionResolver } from '../../../src/pagination/rolesConnection'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { Permission } from '../../../src/entities/permission'
import { createPermission } from '../../factories/permission.factory'
import { createUser } from '../../factories/user.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import {
    rolesConnectionChild as organizationRolesConnectionChild,
    rolesConnectionChildResolver as organizationRolesConnectionChildResolver,
} from '../../../src/schemas/organization'
import { RoleConnectionNode } from '../../../src/types/graphQL/role'
import {
    rolesConnectionChild as permissionRolesConnectionChild,
    rolesConnectionChildResolver as permissionRolesConnectionChildResolver,
} from '../../../src/schemas/permission'
import { createEntityScope } from '../../../src/directives/isAdmin'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createSchool } from '../../factories/school.factory'
import { getAdminAuthToken, getNonAdminAuthToken } from '../../utils/testConfig'
import { runQuery } from '../../utils/operations/modelOps'
import { PermissionName } from '../../../src/permissions/permissionNames'

use(chaiAsPromised)

describe('rolesConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1Roles: Role[] = []
    let org2Roles: Role[] = []
    let roles: Role[] = []
    let scope: SelectQueryBuilder<Role>
    let info: GraphQLResolveInfo
    let systemRoles: Role[]
    let systemRolesCount = 0
    const ownedRolesCount = 10
    const pageSize = 10

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        scope = Role.createQueryBuilder('Role')
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
        systemRoles = await Role.find({
            where: {
                system_role: true,
            },
        })
        systemRolesCount = systemRoles.length
        admin = await createAdminUser(testClient)
        org1 = createOrganization(admin)
        org2 = createOrganization(admin)
        await connection.manager.save([org1, org2])
        org1Roles = []
        org2Roles = []
        roles = []

        for (let i = 0; i < ownedRolesCount / 2; i++) {
            const role = createRole(`role ${i}`, org1)
            role.status = Status.INACTIVE
            org1Roles.push(role)
        }

        for (let i = 0; i < ownedRolesCount / 2; i++) {
            const role = createRole(`role ${i}`, org2)
            role.status = Status.INACTIVE
            org2Roles.push(role)
        }

        roles.push(...org1Roles, ...org2Roles)

        await connection.manager.save(roles)
    })

    context('pagination', () => {
        it('returns roles from all the list', async () => {
            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
            })

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.edges.length).eq(pageSize)
            expect(result.totalCount).to.eq(systemRolesCount + ownedRolesCount)
        })
    })

    context('sorting', () => {
        it('returns roles sorted by id in an ascending order', async () => {
            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'id', order: 'ASC' },
            })

            expect(result.totalCount).to.eq(systemRolesCount + ownedRolesCount)
            expect(result.edges.length).eq(pageSize)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns roles sorted by id in a descending order', async () => {
            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'id', order: 'DESC' },
            })

            expect(result.totalCount).to.eq(systemRolesCount + ownedRolesCount)
            expect(result.edges.length).eq(pageSize)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns roles sorted by name in an ascending order', async () => {
            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'name', order: 'ASC' },
            })

            expect(result.totalCount).to.eq(systemRolesCount + ownedRolesCount)
            expect(result.edges.length).eq(pageSize)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns roles sorted by name in an descending order', async () => {
            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                sort: { field: 'name', order: 'DESC' },
            })

            expect(result.totalCount).to.eq(systemRolesCount + ownedRolesCount)
            expect(result.edges.length).eq(pageSize)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
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

            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eq(ownedRolesCount / 2)
            expect(result.edges.length).eq(ownedRolesCount / 2)

            const roleIds = result.edges.map((edge) => edge.node.id)
            const org1RoleIds = org1Roles.map((role) => role.role_id)
            roleIds.every((id) => org1RoleIds.includes(id))
        })

        it('supports filtering by role name', async () => {
            const matchingName = 'role 0'
            const rolesWithMatchingName = await getRepository(Role)
                .createQueryBuilder('role')
                .where('role.role_name like :name', {
                    name: `%${matchingName}%`,
                })
                .getMany()
            const filterValue = matchingName
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: filterValue,
                },
            }

            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eq(rolesWithMatchingName.length)
            const names = result.edges.map((edge) => edge.node.name)
            names.every((name) => name?.includes(filterValue))
        })

        it('supports filtering by status', async () => {
            const filterStatus = 'inactive'
            const inactiveRoles = await Role.find({
                where: { status: filterStatus },
            })
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eq(inactiveRoles.length)

            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by role system', async () => {
            const filterSystem = true
            const systemroles = await Role.find({
                where: { system_role: filterSystem },
            })
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await rolesConnectionResolver(info, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
                filter,
            })

            expect(result.totalCount).to.eq(systemroles.length)

            const systems = result.edges.map((edge) => edge.node.system)
            systems.every((system) => system === filterSystem)
        })

        context('supports filtering by membership organization ID', () => {
            let member: User
            let filter: IEntityFilter

            beforeEach(async () => {
                member = await createUser().save()
                await createOrganizationMembership({
                    user: member,
                    organization: org1,
                    roles: org1Roles,
                }).save()

                filter = {
                    membershipOrganizationId: {
                        operator: 'eq',
                        value: org1.organization_id,
                    },
                }
            })

            it('with an admin scope', async () => {
                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    org1Roles.map((r) => r.role_id)
                )
            })
            it('with a non-admin scope', async () => {
                const token = { id: member.user_id }
                const permissions = new UserPermissions(token)
                const scope = (await createEntityScope({
                    permissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    org1Roles.map((r) => r.role_id)
                )
            })
        })

        context('supports filtering by membership user ID', () => {
            let member: User
            let filter: IEntityFilter

            beforeEach(async () => {
                member = await createUser().save()
                await createOrganizationMembership({
                    user: member,
                    organization: org1,
                    roles: org1Roles,
                }).save()

                filter = {
                    membershipOrganizationUserId: {
                        operator: 'eq',
                        value: member.user_id,
                    },
                }
            })

            it('with an admin scope', async () => {
                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    org1Roles.map((r) => r.role_id)
                )
            })
            it('with a non-admin scope', async () => {
                const token = { id: member.user_id }
                const permissions = new UserPermissions(token)
                const scope = (await createEntityScope({
                    permissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    org1Roles.map((r) => r.role_id)
                )
            })
        })

        context('supports filtering by school ID', () => {
            let member: User
            let filter: IEntityFilter
            let schoolRoles: Role[]

            beforeEach(async () => {
                const school = await createSchool().save()

                schoolRoles = [await createRole('school role', org1).save()]

                member = await createUser().save()
                await createOrganizationMembership({
                    user: member,
                    organization: org1,
                    roles: org1Roles,
                }).save()
                await createSchoolMembership({
                    user: member,
                    school,
                    roles: schoolRoles,
                }).save()

                filter = {
                    schoolId: {
                        operator: 'eq',
                        value: school.school_id,
                    },
                }
            })

            it('with an admin scope', async () => {
                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    schoolRoles.map((r) => r.role_id)
                )
            })
            it('with a non-admin scope', async () => {
                const token = { id: member.user_id }
                const permissions = new UserPermissions(token)
                const scope = (await createEntityScope({
                    permissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    schoolRoles.map((r) => r.role_id)
                )
            })
        })

        context('supports filtering by school membership user ID', () => {
            let member: User
            let filter: IEntityFilter
            let schoolRoles: Role[]

            beforeEach(async () => {
                const school = await createSchool().save()

                schoolRoles = [await createRole('school role', org1).save()]

                member = await createUser().save()
                await createOrganizationMembership({
                    user: member,
                    organization: org1,
                    roles: org1Roles,
                }).save()
                await createSchoolMembership({
                    user: member,
                    school,
                    roles: schoolRoles,
                }).save()

                filter = {
                    schoolUserId: {
                        operator: 'eq',
                        value: member.user_id,
                    },
                }
            })

            it('with an admin scope', async () => {
                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    schoolRoles.map((r) => r.role_id)
                )
            })
            it('with a non-admin scope', async () => {
                const token = { id: member.user_id }
                const permissions = new UserPermissions(token)
                const scope = (await createEntityScope({
                    permissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const result = await rolesConnectionResolver(info, {
                    direction: 'FORWARD',
                    directionArgs: { count: pageSize },
                    scope,
                    filter,
                })

                const returnedRoles = result.edges.map((edge) => edge.node.id)

                expect(returnedRoles).to.have.members(
                    schoolRoles.map((r) => r.role_id)
                )
            })
        })
    })

    context('as child connection', async () => {
        let fakeResolverInfo: any

        beforeEach(() => {
            fakeResolverInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'rolesConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        // these tests use organizations as the parent
        // but test code paths that are common across all child connection implementation
        // regardless of the parent entity type
        context('common across all parents', () => {
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                const user = await createUser().save()
                await createOrganizationMembership({
                    user,
                    organization: org1,
                }).save()

                const token = { id: user.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            const resolveForRoles = async (organizations: Organization[]) => {
                const loaderResults = []
                for (const organization of organizations) {
                    const loaderResult = organizationRolesConnectionChild(
                        organization.organization_id,
                        {},
                        ctx.loaders,
                        false
                    )
                    loaderResults.push(loaderResult)
                }

                await Promise.all(loaderResults)
            }

            it("db calls doen't increase with number of resolver calls", async () => {
                // warm up permission caches
                await resolveForRoles([org1, org2])
                connection.logger.reset()

                await resolveForRoles([org1])
                const dbCallsForSingleRole = connection.logger.count
                connection.logger.reset()

                await resolveForRoles([org1, org2])
                const dbCallsForTwoRoles = connection.logger.count
                expect(dbCallsForTwoRoles).to.be.eq(dbCallsForSingleRole)
            })

            context('sorting', () => {
                let args: IChildPaginationArgs

                beforeEach(() => {
                    args = {
                        direction: 'FORWARD',
                        count: 50,
                        sort: {
                            field: 'given_name',
                            order: 'ASC',
                        },
                    }
                })

                const checkSorted = async (
                    entityProperty: keyof Role,
                    fieldName: keyof RoleConnectionNode
                ) => {
                    const result = await organizationRolesConnectionChild(
                        org1.organization_id,
                        args,
                        ctx.loaders,
                        false
                    )

                    const sorted = org1Roles
                        .concat(systemRoles)
                        .map((r) => r[entityProperty])
                        .sort((a, b) => {
                            // pagination sorting sorts in a case insensitive way
                            return (a as string)
                                .toLowerCase()
                                .localeCompare((b as string).toLowerCase())
                        })

                    expect(
                        result.edges.map((e) => e.node[fieldName])
                    ).deep.equal(sorted)
                }

                it('sorts by id', async () => {
                    args.sort!.field = 'role_id'

                    return checkSorted('role_id', 'id')
                })
                it('sorts by name', async () => {
                    args.sort!.field = 'role_name'

                    return checkSorted('role_name', 'name')
                })
            })
        })

        context('organization parent', () => {
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                const user = await createUser().save()
                await createOrganizationMembership({
                    user,
                    organization: org1,
                }).save()

                const token = { id: user.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns roles per organization and system roles', async () => {
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: org1Roles.length,
                }

                const result = await organizationRolesConnectionChild(
                    org1.organization_id,
                    args,
                    ctx.loaders,
                    true
                )

                expect(result.totalCount).to.be.eq(
                    org1Roles.length + systemRolesCount
                )
                expect(
                    org1Roles.concat(systemRoles).map((m) => m.role_id)
                ).include.members(result.edges.map((e) => e.node.id))
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) => {
                    return organizationRolesConnectionChildResolver(
                        { id: org1.organization_id },
                        {},
                        ctx,
                        fakeInfo
                    )
                }

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(
                        org1Roles.length + systemRolesCount
                    )
                })

                it('doesnt return total count', async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })

        context('permission parent', () => {
            let ctx: { loaders: IDataLoaders }

            let permission1: Permission
            let permission2: Permission

            let permission1Roles: Role[]

            beforeEach(async () => {
                const role1 = await createRole('role1', org1).save()
                const role2 = await createRole('role2', org1).save()
                const role3 = await createRole('role3', org1).save()

                permission1 = await createPermission(role1).save()
                permission2 = await createPermission(role2).save()
                ;(await role3.permissions)?.push(permission1)
                await role3.save()
                ;(await role3.permissions)?.push(permission1)
                await role3.save()
                ;(await permission1.roles)?.push(role3)
                await permission1.save()

                permission1Roles = [role1, role3]

                const user = await createUser().save()
                await createOrganizationMembership({
                    user,
                    organization: org1,
                }).save()

                const token = { id: user.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns correct roles per permission', async () => {
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: permission1Roles.length,
                }

                const result = await permissionRolesConnectionChild(
                    permission1.permission_name,
                    args,
                    ctx.loaders,
                    false
                )

                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    permission1Roles.map((r) => r.role_id)
                )
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) => {
                    return permissionRolesConnectionChildResolver(
                        { name: permission1.permission_name },
                        {},
                        ctx,
                        fakeInfo
                    )
                }

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(permission1Roles.length)
                })

                it('doesnt return total count', async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })
    })

    context('child connections', () => {
        let org: Organization
        beforeEach(async () => {
            org = await createOrganization().save()
        })

        it('dataloads child connections', async () => {
            const expectedCount = 3

            const query = `
            query {
                rolesConnection(direction: FORWARD) {                   #1
                    edges {
                        node {
                            permissionsConnection(direction: FORWARD){
                                totalCount                              #2
                                edges {                                 #3
                                    node {
                                        id
                                    }
                                }
                            }
                        }
                    }
        
                }
            }
            `

            connection.logger.reset()
            await runQuery(query, testClient, {
                authorization: getAdminAuthToken(),
            })
            expect(connection.logger.count).to.be.eq(expectedCount)

            const nonAdmin = await createNonAdminUser(testClient)
            const role = await createRole('role', org, {
                permissions: [PermissionName.view_roles_and_permissions_30110],
            }).save()
            await createOrganizationMembership({
                user: nonAdmin,
                organization: org,
                roles: [role],
            }).save()

            connection.logger.reset()
            await runQuery(query, testClient, {
                authorization: getNonAdminAuthToken(),
            })
            expect(connection.logger.count).to.be.eq(
                expectedCount + 2,
                'two extra for permission checks (orgMemberships, schoolMemberships)'
            )
        })
    })
})
