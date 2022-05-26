import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
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
import { TestConnection } from '../../utils/testConnection'
import gql from 'graphql-tag'
import { gqlTry } from '../../utils/gqlTry'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import { getAdminAuthToken } from '../../utils/testConfig'
import { userToPayload } from '../../utils/operations/userOps'
import { createAdminUser } from '../../factories/user.factory'
import { Category } from '../../../src/entities/category'
import { CategoryConnectionNode } from '../../../src/types/graphQL/category'
import { createCategory } from '../../factories/category.factory'
import { NIL_UUID } from '../../utils/database'

use(chaiAsPromised)

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

describe('categoryNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminPermissions: UserPermissions
    let category1: Category
    let category2: Category

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

    async function category2Nodes(headers: Headers, id: string, id2: string) {
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

    const getCategoryNode = async (categoryId: string) => {
        const { scope, ctx } = await buildScopeAndContext(adminPermissions)
        const coreResult = (await ctx.loaders.categoryNode.node.instance.load({
            scope,
            id: categoryId,
        })) as CategoryConnectionNode

        return {
            coreResult,
        }
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        category1 = await Category.save(createCategory())
        category2 = await Category.save(createCategory())
        const admin = await createAdminUser().save()
        adminPermissions = new UserPermissions(userToPayload(admin))
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
                { authorization: getAdminAuthToken() },
                category1.id,
                category2.id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(getCategoryNode(NIL_UUID)).to.be.rejected
        })
    })
})
