import { gql } from 'apollo-server-core'
import { expect, use } from 'chai'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import chaiAsPromised from 'chai-as-promised'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { ROLE_FIELDS } from '../../utils/operations/modelOps'
import { gqlTry } from '../../utils/gqlTry'
import { TestConnection } from '../../utils/testConnection'
import { Role } from '../../../src/entities/role'
import { getConnection } from 'typeorm'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { Context } from '../../../src/main'
import { nonAdminRoleScope } from '../../../src/directives/isAdmin'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { RoleConnectionNode } from '../../../src/types/graphQL/role'
import { createServer } from '../../../src/utils/createServer'
import { Model } from '../../../src/model'
import { createAdminUser } from '../../factories/user.factory'
import { userToPayload } from '../../utils/operations/userOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import { NIL_UUID } from '../../utils/database'

use(chaiAsPromised)

const buildScopeAndContext = async (permissions: UserPermissions) => {
    const scope = Role.createQueryBuilder('Role')

    if (!permissions.isAdmin) {
        await nonAdminRoleScope(scope, permissions)
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
    let roles: Role[]

    const getRoleNode = async (roleId: string) => {
        const { scope, ctx } = await buildScopeAndContext(adminPermissions)
        return (await ctx.loaders.roleNode.node.instance.load({
            scope,
            id: roleId,
        })) as RoleConnectionNode
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        roles = await Role.find()
        const admin = await createAdminUser().save()
        adminPermissions = new UserPermissions(userToPayload(admin))
    })

    context('data', () => {
        it('should get the correct role with its correct data', async () => {
            const roleToTest = roles[0]
            const result = await getRoleNode(roleToTest.role_id)

            expect(result).to.exist
            expect(result).to.be.an('object')
            expect(result.id).to.be.eq(roleToTest.role_id)
            expect(result.name).to.be.eq(roleToTest.role_name)
            expect(result.description).to.be.eq(roleToTest.role_description)
            expect(result.status).to.be.eq(roleToTest.status)
            expect(result.system).to.be.eq(roleToTest.system_role)
        })
    })

    context('database calls', () => {
        const ROLE_NODE_QUERY_2_NODES = gql`
            ${ROLE_FIELDS}

            query($id: ID!, $id2: ID!) {
                role1: roleNode(id: $id) {
                    ...roleFields
                }

                role2: roleNode(id: $id2) {
                    ...roleFields
                }
            }
        `

        async function role2Nodes(headers: Headers, id: string, id2: string) {
            const { query } = testClient
            const operation = () =>
                query({
                    query: print(ROLE_NODE_QUERY_2_NODES),
                    variables: {
                        id,
                        id2,
                    },
                    headers,
                })

            await gqlTry(operation)
        }

        it('makes just 3 call to the databases, 1 for the roleNodes 2 for their child permissionsConnections', async () => {
            connection.logger.reset()

            await role2Nodes(
                { authorization: getAdminAuthToken() },
                roles[0].role_id,
                roles[1].role_id
            )

            expect(connection.logger.count).to.be.eq(3)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(getRoleNode(NIL_UUID)).to.be.rejected
        })
    })
})
