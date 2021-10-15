import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Permission } from '../../../src/entities/permission'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { PermissionConnectionNode } from '../../../src/types/graphQL/permissionConnectionNode'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { permissionsConnection } from '../../utils/operations/modelOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

type PermissionKey = keyof Pick<
    Permission,
    | 'permission_id'
    | 'permission_name'
    | 'permission_category'
    | 'permission_group'
    | 'permission_level'
>

type PermissionConnectionNodeKey = keyof Pick<
    PermissionConnectionNode,
    'id' | 'name' | 'category' | 'group' | 'level'
>

use(chaiAsPromised)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let permissionsCount = 0
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
        admin = createAdminUser()
        permissionsCount = await Permission.count()
    })

    context('pagination', () => {
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
        it('supports filtering by organization ID', async () => {})

        it('supports filtering by role ID', async () => {})

        it('supports filtering by permission name', async () => {})

        it('supports filtering by permission allow', async () => {})
    })

    context('user permissions', () => {
        context('when user is a super admin', () => {
            it('can access to all the permissions', () => {})

            it('can access to own permissions', () => {})

            context('when it does not have any membership', () => {
                context('and filter by organization ID is applied', () => {
                    it('should get all the permissions', () => {})
                })
            })
        })

        context('when user is not super admin', () => {
            it('can access just to the permissions specified on its roles', () => {})
        })
    })

    context('when totalCount is not requested', () => {})
})
