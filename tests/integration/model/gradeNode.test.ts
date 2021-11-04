import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { SelectQueryBuilder } from 'typeorm'
import { nonAdminGradeScope } from '../../../src/directives/isAdmin'
import { Grade } from '../../../src/entities/grade'
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
import GradesInitializer from '../../../src/initializers/grades'
import {
    GradeConnectionNode,
    GradeSummaryNode,
} from '../../../src/types/graphQL/grade'
import { GRADE_MAIN_FIELDS } from '../../utils/operations/modelOps'
import gql from 'graphql-tag'
import { gqlTry } from '../../utils/gqlTry'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import { getAdminAuthToken } from '../../utils/testConfig'
import { userToPayload } from '../../utils/operations/userOps'
import { createAdminUser } from '../../factories/user.factory'

use(chaiAsPromised)

const GRADE_NODE_QUERY_2_NODES = gql`
    ${GRADE_MAIN_FIELDS}

    query($id: ID!, $id2: ID!) {
        grade1: gradeNode(id: $id) {
            ...gradeMainFields
        }

        grade2: gradeNode(id: $id2) {
            ...gradeMainFields
        }
    }
`

async function grade2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: print(GRADE_NODE_QUERY_2_NODES),
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

describe('gradeNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let scope: SelectQueryBuilder<Grade>
    let adminPermissions: UserPermissions
    let ctx: Context
    let grades: Grade[]

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        const scopeObject = Grade.createQueryBuilder('Grade')

        if (!permissions.isAdmin) {
            await nonAdminGradeScope(scopeObject, permissions)
        }

        const ctxObject = ({
            permissions,
            loaders: createContextLazyLoaders(permissions),
        } as unknown) as Context

        return { scope: scopeObject, ctx: ctxObject }
    }

    const getGradeNode = async (gradeId: string) => {
        const coreResult = (await ctx.loaders.gradeNode.node.instance.load({
            scope,
            id: gradeId,
        })) as GradeConnectionNode

        const fromGradeResult = (await ctx.loaders.gradesConnection.fromGrade.instance.load(
            gradeId
        )) as GradeSummaryNode

        const toGradeResult = (await ctx.loaders.gradesConnection.toGrade.instance.load(
            gradeId
        )) as GradeSummaryNode

        return {
            coreResult,
            fromGradeResult,
            toGradeResult,
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
        await GradesInitializer.run()
        grades = await Grade.find()
        const admin = await createAdminUser().save()

        // Emulating context
        adminPermissions = new UserPermissions(userToPayload(admin))
        const result = await buildScopeAndContext(adminPermissions)
        scope = result.scope
        ctx = result.ctx
    })

    context('data', () => {
        it('should get the correct grade with its correct data', async () => {
            const gradeToTest = await Grade.findOneOrFail({
                where: { name: 'PreK-1', system: true },
            })

            const {
                coreResult,
                fromGradeResult,
                toGradeResult,
            } = await getGradeNode(gradeToTest.id)

            expect(coreResult).to.exist
            expect(coreResult).to.be.an('object')
            expect(coreResult.id).to.eq(gradeToTest.id)
            expect(coreResult.name).to.eq(gradeToTest.name)
            expect(coreResult.status).to.eq(gradeToTest.status)
            expect(coreResult.system).to.eq(gradeToTest.system)

            const fromGrade = (await gradeToTest.progress_from_grade) as Grade
            expect(fromGradeResult).to.exist
            expect(fromGradeResult).to.be.an('object')
            expect(fromGradeResult.id).to.eq(fromGrade.id)
            expect(fromGradeResult.name).to.eq(fromGrade.name)
            expect(fromGradeResult.status).to.eq(fromGrade.status)
            expect(fromGradeResult.system).to.eq(fromGrade.system)

            const toGrade = (await gradeToTest.progress_to_grade) as Grade
            expect(toGradeResult).to.exist
            expect(toGradeResult).to.be.an('object')
            expect(toGradeResult.id).to.eq(toGrade.id)
            expect(toGradeResult.name).to.eq(toGrade.name)
            expect(toGradeResult.status).to.eq(toGrade.status)
            expect(toGradeResult.system).to.eq(toGrade.system)
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await grade2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                grades[0].id,
                grades[1].id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(
                ctx.loaders.gradeNode.node.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
