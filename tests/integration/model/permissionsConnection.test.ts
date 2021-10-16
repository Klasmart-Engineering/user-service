import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Permission } from '../../../src/entities/permission'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { PERMISSIONS_CONNECTION_COLUMNS } from '../../../src/pagination/permissionsConnection'
import { PermissionConnectionNode } from '../../../src/types/graphQL/permissionConnectionNode'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { permissionsConnection } from '../../utils/operations/modelOps'
import { getSystemRoleIds } from '../../utils/operations/organizationOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { Organization } from '../../../src/entities/organization'
import { createOrganization } from '../../factories/organization.factory'
import { Role } from '../../../src/entities/role'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'
import { userToPayload } from '../../utils/operations/userOps'

type PermissionConnectionNodeKey = keyof Pick<
    PermissionConnectionNode,
    'id' | 'name' | 'category' | 'group' | 'level'
>

use(chaiAsPromised)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let organizationUser: User
    let schoolUser: User
    let noMembershipUser: User
    let organization: Organization
    let school: School
    let permissionsCount = 0
    let systemRolesPermissionsCount = 0
    const pageSize = 10

    const expectSorting = async (
        field: PermissionConnectionNodeKey,
        order: 'ASC' | 'DESC'
    ) => {
        const result = await permissionsConnection(
            testClient,
            'FORWARD',
            true,
            { count: pageSize },
            { authorization: getAdminAuthToken() },
            undefined,
            { field, order }
        )

        expect(result.totalCount).to.eql(permissionsCount)
        expect(result.edges.length).eq(pageSize)

        const values = result.edges.map((edge) => edge.node[field]) as string[]
        const isSorted =
            order === 'ASC'
                ? isStringArraySortedAscending(values)
                : isStringArraySortedDescending(values)

        expect(isSorted).to.be.true
    }

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        permissionsCount = await Permission.count()
        systemRolesPermissionsCount = await Permission.createQueryBuilder(
            'Permission'
        )
            .select(PERMISSIONS_CONNECTION_COLUMNS)
            .innerJoin('Permission.roles', 'Role')
            .where('Role.system_role = true')
            .getCount()
    })

    context('pagination', () => {
        beforeEach(async () => {
            const teacherRole = await Role.findOneOrFail({
                where: { system_role: true, role_name: 'Teacher' },
            })

            const orgAdminRole = await Role.findOneOrFail({
                where: { system_role: true, role_name: 'Organization Admin' },
            })

            organizationUser = createUser()
            schoolUser = createUser()
            noMembershipUser = createUser()
            organization = createOrganization()

            await connection.manager.save([
                organizationUser,
                schoolUser,
                noMembershipUser,
            ])

            await connection.manager.save(organization)

            school = createSchool(organization)
            await connection.manager.save(school)

            // adding organizationUser to organization with orgAdminRole
            await connection.manager.save(
                createOrganizationMembership({
                    user: organizationUser,
                    organization,
                    roles: [orgAdminRole],
                })
            )

            // adding schoolUser to organization with orgAdminRole
            await connection.manager.save(
                createSchoolMembership({
                    user: schoolUser,
                    school,
                    roles: [teacherRole],
                })
            )
        })

        context('when user is super admin', () => {
            it('returns permissions from all the list', async () => {
                const result = await permissionsConnection(
                    testClient,
                    'FORWARD',
                    true,
                    { count: pageSize },
                    { authorization: getAdminAuthToken() }
                )

                expect(result.totalCount).to.eql(permissionsCount)

                expect(result.pageInfo.hasNextPage).to.be.true
                expect(result.pageInfo.hasPreviousPage).to.be.false
                expect(result.pageInfo.startCursor).to.be.string
                expect(result.pageInfo.endCursor).to.be.string

                expect(result.edges.length).eq(10)
            })
        })

        context('when user has organizationMembership', () => {
            it('returns just the permissions related to system roles', async () => {
                const token = generateToken(userToPayload(organizationUser))
                const result = await permissionsConnection(
                    testClient,
                    'FORWARD',
                    true,
                    { count: pageSize },
                    { authorization: token }
                )

                expect(result.totalCount).to.eql(systemRolesPermissionsCount)

                expect(result.pageInfo.hasNextPage).to.be.true
                expect(result.pageInfo.hasPreviousPage).to.be.false
                expect(result.pageInfo.startCursor).to.be.string
                expect(result.pageInfo.endCursor).to.be.string

                expect(result.edges.length).eq(10)
            })
        })

        context('when user has schoolMembership', () => {
            it('returns just the permissions related to system roles', async () => {
                const token = generateToken(userToPayload(schoolUser))
                const result = await permissionsConnection(
                    testClient,
                    'FORWARD',
                    true,
                    { count: pageSize },
                    { authorization: token }
                )

                expect(result.totalCount).to.eql(systemRolesPermissionsCount)

                expect(result.pageInfo.hasNextPage).to.be.true
                expect(result.pageInfo.hasPreviousPage).to.be.false
                expect(result.pageInfo.startCursor).to.be.string
                expect(result.pageInfo.endCursor).to.be.string

                expect(result.edges.length).eq(10)
            })
        })

        context('when user has not any memberships', () => {
            it('should not have access to any permission', async () => {
                const token = generateToken(userToPayload(noMembershipUser))
                const result = await permissionsConnection(
                    testClient,
                    'FORWARD',
                    true,
                    { count: pageSize },
                    { authorization: token }
                )

                expect(result.totalCount).to.eql(0)

                expect(result.pageInfo.hasNextPage).to.be.false
                expect(result.pageInfo.hasPreviousPage).to.be.false
                expect(result.pageInfo.startCursor).to.be.string
                expect(result.pageInfo.endCursor).to.be.string

                expect(result.edges.length).eq(0)
            })
        })
    })

    context('sorting', () => {
        it("returns permissions sorted by 'id' in an ASCENDING order", async () => {
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

        it("returns permissions sorted by 'category' in an ASCENDING order", async () => {
            await expectSorting('category', 'ASC')
        })

        it("returns permissions sorted by 'category' in a DESCENDING order", async () => {
            await expectSorting('category', 'DESC')
        })

        it("returns permissions sorted by 'group' in an ASCENDING order", async () => {
            await expectSorting('group', 'ASC')
        })

        it("returns permissions sorted by 'group' in a DESCENDING order", async () => {
            await expectSorting('group', 'DESC')
        })

        it("returns permissions sorted by 'level' in an ASCENDING order", async () => {
            await expectSorting('level', 'ASC')
        })

        it("returns permissions sorted by 'level' in a DESCENDING order", async () => {
            await expectSorting('level', 'DESC')
        })
    })

    context('filtering', () => {
        beforeEach(async () => {
            const notAllowedPermission = await Permission.findOneOrFail()
            notAllowedPermission.allow = false

            await connection.manager.save(notAllowedPermission)
        })

        it('supports filtering by role ID', async () => {
            const systemRoles = await getSystemRoleIds()
            const studentRoleId = systemRoles['Student']
            const filter: IEntityFilter = {
                roleId: { operator: 'eq', value: studentRoleId },
            }

            const result = await permissionsConnection(
                testClient,
                'FORWARD',
                true,
                { count: pageSize },
                { authorization: getAdminAuthToken() },
                filter
            )

            const studentPermissions = await Permission.createQueryBuilder(
                'Permission'
            )
                .select(PERMISSIONS_CONNECTION_COLUMNS)
                .innerJoin('Permission.roles', 'Role')
                .where('Role.role_id = :studentRoleId', { studentRoleId })
                .orderBy('Permission.permission_name', 'ASC', 'NULLS LAST')
                .getMany()

            expect(result.totalCount).to.eql(studentPermissions.length)

            result.edges.forEach((edge, index) => {
                expect(edge.node.id).to.be.eql(
                    studentPermissions[index].permission_id
                )
                expect(edge.node.name).to.be.eql(
                    studentPermissions[index].permission_name
                )
                expect(edge.node.category).to.be.eql(
                    studentPermissions[index].permission_category
                )
                expect(edge.node.group).to.be.eql(
                    studentPermissions[index].permission_group
                )
                expect(edge.node.level).to.be.eql(
                    studentPermissions[index].permission_level
                )
                expect(edge.node.description).to.be.eql(
                    studentPermissions[index].permission_description
                )
                expect(edge.node.allow).to.be.eql(
                    studentPermissions[index].allow
                )
            })
        })

        it('supports filtering by permission name', async () => {
            const searching = 'attend'
            const filter: IEntityFilter = {
                name: { operator: 'contains', value: searching },
            }

            const result = await permissionsConnection(
                testClient,
                'FORWARD',
                true,
                { count: pageSize },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eql(5)

            result.edges.forEach((edge) => {
                expect(edge.node.name).includes(searching)
            })
        })

        it('supports filtering by permission allow', async () => {
            const allowValue = false
            const filter: IEntityFilter = {
                allow: { operator: 'eq', value: allowValue },
            }

            const result = await permissionsConnection(
                testClient,
                'FORWARD',
                true,
                { count: pageSize },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eql(1)

            result.edges.forEach((edge) => {
                expect(edge.node.allow).to.eql(allowValue)
            })
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await permissionsConnection(
                testClient,
                'FORWARD',
                false,
                { count: pageSize },
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })
})
