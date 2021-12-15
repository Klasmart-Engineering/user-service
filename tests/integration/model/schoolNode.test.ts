import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { SelectQueryBuilder } from 'typeorm'
import { Organization } from '../../../src/entities/organization'
import { School } from '../../../src/entities/school'
import { User } from '../../../src/entities/user'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { ISchoolsConnectionNode } from '../../../src/types/graphQL/school'
import { createServer } from '../../../src/utils/createServer'
import { createOrganization } from '../../factories/organization.factory'
import { createSchool } from '../../factories/school.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { gqlTry } from '../../utils/gqlTry'
import { gql } from 'graphql-tag'
import { Headers } from 'node-mocks-http'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { userToPayload } from '../../utils/operations/userOps'

use(deepEqualInAnyOrder)

function expectSchoolConnectionEdge(
    queryResult: ISchoolsConnectionNode,
    schoolToCompare: School
) {
    expect(queryResult.id).to.eql(schoolToCompare.school_id)
    expect(queryResult.name).to.eql(schoolToCompare.school_name)
    expect(queryResult.status).to.eql(schoolToCompare.status)
    expect(queryResult.shortCode).to.eql(schoolToCompare.shortcode)
}

use(chaiAsPromised)

const SCHOOL_NODE_QUERY_2_NODES = gql`
    query($id: ID!, $id2: ID!) {
        schoolNode(id: $id) {
            name
        }
        schoolNode2: schoolNode(id: $id2) {
            name
        }
    }
`

export async function school2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: SCHOOL_NODE_QUERY_2_NODES,
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

describe('schoolNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org1Schools: School[] = []
    let scope: SelectQueryBuilder<School>
    const schoolsCount = 2
    let adminPermissions: UserPermissions

    // emulated ctx object to could test resolver
    let ctx: Context
    const buildScopeAndContext = async (permissions: UserPermissions) => {
        const scopeObject = School.createQueryBuilder('School')

        const ctxObject = ({
            permissions,
            loaders: createContextLazyLoaders(permissions),
        } as unknown) as Context

        return { scope: scopeObject, ctx: ctxObject }
    }

    const getSchoolNode = async (schoolId: string) => {
        const coreResult = (await ctx.loaders.schoolNode.instance.load({
            scope,
            id: schoolId,
        })) as ISchoolsConnectionNode

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
        scope = School.createQueryBuilder('School')

        admin = await createAdminUser(testClient)
        org1 = await createOrganization().save()

        org1Schools = await School.save(
            Array.from(Array(schoolsCount), (_, i) => {
                const s = createSchool(org1)
                s.school_name = `school ${i}`
                return s
            })
        )

        adminPermissions = new UserPermissions(userToPayload(admin))

        // Emulating context
        const result = await buildScopeAndContext(adminPermissions)
        scope = result.scope
        ctx = result.ctx
    })

    context('data', () => {
        beforeEach(async () => {
            await Promise.all(org1Schools.map((c) => c.save()))
        })

        it('should get the correct school with its corresponding data', async () => {
            const schoolToTest = org1Schools[0]
            const { coreResult } = await getSchoolNode(schoolToTest.school_id)
            expectSchoolConnectionEdge(coreResult, schoolToTest)
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            const schoolToTest1 = org1Schools[0]
            const schoolToTest2 = org1Schools[1]

            connection.logger.reset()

            await school2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                schoolToTest1.school_id,
                schoolToTest2.school_id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it("throws an error if id doesn't exist", async () => {
            await expect(
                ctx.loaders.schoolNode.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
