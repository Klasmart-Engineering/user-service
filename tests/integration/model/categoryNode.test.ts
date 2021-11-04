import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { SelectQueryBuilder } from 'typeorm'
import { nonAdminCategoryScope } from '../../../src/directives/isAdmin'
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
import { CategorySummaryNode } from '../../../src/types/graphQL/category'
import { createCategory } from '../../factories/category.factory'

use(chaiAsPromised)

const CATEGORY_NODE_QUERY_2_NODES = gql`
    query($id: ID!, $id2: ID!) {
        category1: categoryNode(id: $id) {
            id
            name
        }

        category2: categoryNode(id: $id2) {
            id
            name
        }
    }
`

async function category2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: print(CATEGORY_NODE_QUERY_2_NODES),
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

describe('categoryNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let scope: SelectQueryBuilder<Category>
    let adminPermissions: UserPermissions
    let ctx: Context
    let category1: Category
    let category2: Category

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        const scopeObject = Category.createQueryBuilder('Category')

        if (!permissions.isAdmin) {
            await nonAdminCategoryScope(scopeObject, permissions)
        }

        const ctxObject = ({
            permissions,
            loaders: createContextLazyLoaders(permissions),
        } as unknown) as Context

        return { scope: scopeObject, ctx: ctxObject }
    }

    const getCategoryNode = async (categoryId: string) => {
        const coreResult = (await ctx.loaders.categoryNode.node.instance.load({
            scope,
            id: categoryId,
        })) as CategorySummaryNode

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
        category1 = await Category.save(createCategory())
        category2 = await Category.save(createCategory())
        const admin = await createAdminUser().save()

        // Emulating context
        adminPermissions = new UserPermissions(userToPayload(admin))
        const result = await buildScopeAndContext(adminPermissions)
        scope = result.scope
        ctx = result.ctx
    })

    context('data', () => {
        it('should get the correct category with its correct data', async () => {
            const { coreResult } = await getCategoryNode(category1.id)

            expect(coreResult).to.exist
            expect(coreResult.id).to.eq(category1.id)
            expect(coreResult.name).to.eq(category1.name)
            expect(coreResult.status).to.eq(category1.status)
            expect(coreResult.system).to.eq(category1.system)
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await category2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                category1.id,
                category2.id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(
                ctx.loaders.categoryNode.node.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
