import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createServer } from '../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import gql from 'graphql-tag'
import { gqlTry } from '../../utils/gqlTry'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import { getAdminAuthToken } from '../../utils/testConfig'
import { userToPayload } from '../../utils/operations/userOps'
import { createAdminUser } from '../../factories/user.factory'
import { Category } from '../../../src/entities/category'
import { NIL_UUID } from '../../utils/database'
import { Subcategory } from '../../../src/entities/subcategory'
import { SubcategoryConnectionNode } from '../../../src/types/graphQL/subcategory'
import { nonAdminSubcategoryScope } from '../../../src/directives/isAdmin'
import { createSubcategory } from '../../factories/subcategory.factory'

use(chaiAsPromised)

const buildScopeAndContext = async (permissions: UserPermissions) => {
    const scopeObject = Subcategory.createQueryBuilder('Subcategory')

    if (!permissions.isAdmin) {
        await nonAdminSubcategoryScope(scopeObject, permissions)
    }

    const ctxObject = ({
        permissions,
        loaders: createContextLazyLoaders(permissions),
    } as unknown) as Context

    return { scope: scopeObject, ctx: ctxObject }
}

describe('subcategoryNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminPermissions: UserPermissions
    let subcategory1: Subcategory
    let subcategory2: Subcategory

    const getSubcategoryNode = async (subcategoryId: string) => {
        const { scope, ctx } = await buildScopeAndContext(adminPermissions)
        const coreResult = (await ctx.loaders.subcategoryNode.node.instance.load(
            {
                scope,
                id: subcategoryId,
            }
        )) as SubcategoryConnectionNode

        return {
            coreResult,
        }
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
        subcategory1 = await Subcategory.save(createSubcategory())
        subcategory2 = await Subcategory.save(createSubcategory())
        const admin = await createAdminUser().save()
        adminPermissions = new UserPermissions(userToPayload(admin))
    })

    context('data', () => {
        it('should get the correct category with its correct data', async () => {
            const { coreResult } = await getSubcategoryNode(subcategory1.id)

            expect(coreResult).to.exist
            expect(coreResult.id).to.eq(subcategory1.id)
            expect(coreResult.name).to.eq(subcategory1.name)
            expect(coreResult.status).to.eq(subcategory1.status)
            expect(coreResult.system).to.eq(subcategory1.system)
        })
    })

    context('database calls', () => {
        const SUBCATEGORY_NODE_QUERY_2_NODES = gql`
            query($id: ID!, $id2: ID!) {
                subcategory1: subcategoryNode(id: $id) {
                    id
                    name
                }
                subcategory2: subcategoryNode(id: $id2) {
                    id
                    name
                }
            }
        `

        async function subcategory2Nodes(
            testClient: ApolloServerTestClient,
            headers: Headers,
            id: string,
            id2: string
        ) {
            const { query } = testClient

            const operation = () =>
                query({
                    query: print(SUBCATEGORY_NODE_QUERY_2_NODES),
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

            await subcategory2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                subcategory1.id,
                subcategory2.id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(getSubcategoryNode(NIL_UUID)).to.be.rejected
        })
    })
})
