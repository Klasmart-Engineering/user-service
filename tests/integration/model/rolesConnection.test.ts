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
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { GraphQLResolveInfo } from 'graphql'
import { getRepository, SelectQueryBuilder } from 'typeorm'
import { rolesConnectionResolver } from '../../../src/pagination/rolesConnection'

use(chaiAsPromised)

describe('model', () => {
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
    let systemRolesCount = 0
    const ownedRolesCount = 10
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
        systemRolesCount = await Role.count()
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
    })
})
