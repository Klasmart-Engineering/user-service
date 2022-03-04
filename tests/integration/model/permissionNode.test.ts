import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import gql from 'graphql-tag'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import { nonAdminPermissionScope } from '../../../src/directives/isAdmin'
import { Permission } from '../../../src/entities/permission'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { PermissionConnectionNode } from '../../../src/types/graphQL/permission'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { PERMISSION_NODE_FIELDS } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { TestConnection } from '../../utils/testConnection'
import { gqlTry } from '../../utils/gqlTry'
import { getAdminAuthToken } from '../../utils/testConfig'
import { getConnection } from 'typeorm'

use(chaiAsPromised)

const buildScopeAndContext = async (permissions: UserPermissions) => {
    const scope = Permission.createQueryBuilder('Permission')

    if (!permissions.isAdmin) {
        await nonAdminPermissionScope(scope, permissions)
    }

    const ctx = ({
        permissions,
        loaders: createContextLazyLoaders(permissions),
    } as unknown) as Context

    return { scope, ctx }
}

describe('roleNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminPermissions: UserPermissions

    let permissions: Permission[]

    const getPermissionNode = async (permissionId: string) => {
        const { scope, ctx } = await buildScopeAndContext(adminPermissions)

        return (await ctx.loaders.permissionNode.node.instance.load({
            scope,
            id: permissionId,
        })) as PermissionConnectionNode
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        permissions = await Permission.find()
        const admin = await createAdminUser().save()
        adminPermissions = new UserPermissions(userToPayload(admin))
    })

    context('data', () => {
        it('should get the correct permission with its correct data', async () => {
            const permissionToTest = permissions[0]
            const result = await getPermissionNode(
                permissionToTest.permission_name
            )

            expect(result).to.exist
            expect(result).to.be.an('object')
            expect(result.id).to.be.eq(permissionToTest.permission_id)
            expect(result.name).to.be.eq(permissionToTest.permission_name)
            expect(result.category).to.be.eq(
                permissionToTest.permission_category
            )
            expect(result.group).to.be.eq(permissionToTest.permission_group)
            expect(result.level).to.be.eq(permissionToTest.permission_level)
            expect(result.description).to.be.eq(
                permissionToTest.permission_description
            )
            expect(result.allow).to.be.eq(permissionToTest.allow)
        })
    })

    context('database calls', () => {
        const PERMISSION_NODE_QUERY_2_NODES = gql`
            ${PERMISSION_NODE_FIELDS}

            query($id: ID!, $id2: ID!) {
                permission1: permissionNode(id: $id) {
                    ...permissionFields
                }

                permission2: permissionNode(id: $id2) {
                    ...permissionFields
                }
            }
        `

        async function permission2Nodes(
            headers: Headers,
            id: string,
            id2: string
        ) {
            const { query } = testClient

            const operation = () =>
                query({
                    query: print(PERMISSION_NODE_QUERY_2_NODES),
                    variables: {
                        id,
                        id2,
                    },
                    headers,
                })

            await gqlTry(operation)
        }

        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await permission2Nodes(
                { authorization: getAdminAuthToken() },
                permissions[0].permission_name,
                permissions[1].permission_name
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(getPermissionNode('not-an-existent-name')).to.be
                .rejected
        })
    })
})
