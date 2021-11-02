import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { SelectQueryBuilder } from 'typeorm'
import { nonAdminAgeRangeScope } from '../../../src/directives/isAdmin'
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
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRange'
import gql from 'graphql-tag'
import { gqlTry } from '../../utils/gqlTry'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import { getAdminAuthToken } from '../../utils/testConfig'
import { userToPayload } from '../../utils/operations/userOps'
import { createAdminUser } from '../../factories/user.factory'
import { AgeRange } from '../../../src/entities/ageRange'
import { createAgeRange } from '../../factories/ageRange.factory'

use(chaiAsPromised)

const AGE_RANGE_NODE_QUERY_2_NODES = gql`
    query($id: ID!, $id2: ID!) {
        ageRange1: ageRangeNode(id: $id) {
            id
            name
        }

        ageRange2: ageRangeNode(id: $id2) {
            id
            name
        }
    }
`

async function ageRange2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: print(AGE_RANGE_NODE_QUERY_2_NODES),
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

describe('ageRangeNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let scope: SelectQueryBuilder<AgeRange>
    let adminPermissions: UserPermissions
    let ctx: Context
    let ageRange1: AgeRange
    let ageRange2: AgeRange

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        const scopeObject = AgeRange.createQueryBuilder('AgeRange')

        if (!permissions.isAdmin) {
            await nonAdminAgeRangeScope(scopeObject, permissions)
        }

        const ctxObject = ({
            permissions,
            loaders: createContextLazyLoaders(permissions),
        } as unknown) as Context

        return { scope: scopeObject, ctx: ctxObject }
    }

    const getAgeRangeNode = async (ageRangeId: string) => {
        const coreResult = (await ctx.loaders.ageRangeNode.node.instance.load({
            scope,
            id: ageRangeId,
        })) as AgeRangeConnectionNode

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
        ageRange1 = await AgeRange.save(createAgeRange())
        ageRange2 = await AgeRange.save(createAgeRange())
        const admin = await createAdminUser().save()

        // Emulating context
        adminPermissions = new UserPermissions(userToPayload(admin))
        const result = await buildScopeAndContext(adminPermissions)
        scope = result.scope
        ctx = result.ctx
    })

    context('data', () => {
        it('should get the correct age ramge with its correct data', async () => {
            const { coreResult } = await getAgeRangeNode(ageRange1.id)

            expect(coreResult).to.exist
            expect(coreResult.id).to.eq(ageRange1.id)
            expect(coreResult.name).to.eq(ageRange1.name)
            expect(coreResult.lowValue).to.eq(ageRange1.low_value)
            expect(coreResult.lowValueUnit).to.eq(ageRange1.low_value_unit)
            expect(coreResult.highValue).to.eq(ageRange1.high_value)
            expect(coreResult.highValueUnit).to.eq(ageRange1.high_value_unit)
            expect(coreResult.status).to.eq(ageRange1.status)
            expect(coreResult.system).to.eq(ageRange1.system)
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await ageRange2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                ageRange1.id,
                ageRange2.id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(
                ctx.loaders.ageRangeNode.node.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
