import { gql } from 'apollo-server-core'
import { expect, use } from 'chai'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import chaiAsPromised from 'chai-as-promised'
import { nonAdminSubjectScope } from '../../../src/directives/isAdmin'
import { Subject } from '../../../src/entities/subject'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { SubjectConnectionNode } from '../../../src/types/graphQL/subject'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { gqlTry } from '../../utils/gqlTry'
import { SUBJECT_MAIN_FIELDS } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { TestConnection } from '../../utils/testConnection'
import { getAdminAuthToken } from '../../utils/testConfig'
import { NIL_UUID } from '../../utils/database'
import { Category } from '../../../src/entities/category'
import { createOrganization } from '../../factories/organization.factory'
import { createSubject } from '../../factories/subject.factory'
import { createCategory } from '../../factories/category.factory'
import { CategoryConnectionNode } from '../../../src/types/graphQL/category'
import { getConnection } from 'typeorm'

use(chaiAsPromised)

const buildScopeAndContext = async (permissions: UserPermissions) => {
    const scope = Subject.createQueryBuilder('Subject')

    if (!permissions.isAdmin) {
        await nonAdminSubjectScope(scope, permissions)
    }
    const ctx = ({
        permissions,
        loaders: createContextLazyLoaders(permissions),
    } as unknown) as Context

    return { scope, ctx }
}

describe('subjectNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminPermissions: UserPermissions
    let subjects: Subject[]
    const subjectsCount = 5
    const categoriesCount = 10

    const getSubjectNode = async (subjectId: string) => {
        const { scope, ctx } = await buildScopeAndContext(adminPermissions)

        const coreResult = (await ctx.loaders.subjectNode.node.instance.load({
            scope,
            id: subjectId,
        })) as SubjectConnectionNode

        const categoriesResult = await ctx.loaders.subjectsConnection.categories.instance.load(
            subjectId
        )

        return { coreResult, categoriesResult }
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        const organization = await createOrganization().save()

        const categories = await Category.save(
            Array.from(Array(categoriesCount), () =>
                createCategory(organization)
            )
        )

        subjects = await Subject.save(
            Array.from(Array(subjectsCount), (_, i) =>
                createSubject(organization, [
                    categories[i * 2],
                    categories[i * 2 + 1],
                ])
            )
        )

        const admin = await createAdminUser().save()
        adminPermissions = new UserPermissions(userToPayload(admin))
    })

    context('data', () => {
        it('should get the correct subject with its correct data', async () => {
            const subjectToTest = subjects[0]
            const { coreResult, categoriesResult } = await getSubjectNode(
                subjectToTest.id
            )

            expect(coreResult).to.exist
            expect(coreResult).to.be.an('object')
            expect(coreResult.id).to.be.eq(subjectToTest.id)
            expect(coreResult.name).to.be.eq(subjectToTest.name)
            expect(coreResult.status).to.be.eq(subjectToTest.status)
            expect(coreResult.system).to.be.eq(subjectToTest.system)

            const subjectCategories = await subjectToTest.categories

            const categoryIsEqualToCategoryConnectionNode = (
                c: Category,
                csn: CategoryConnectionNode
            ) => {
                return (
                    c.id === csn.id &&
                    c.name === csn.name &&
                    c.status === csn.status &&
                    c.system === csn.system
                )
            }

            categoriesResult.forEach((cr) => {
                expect(
                    subjectCategories?.find((sc) =>
                        categoryIsEqualToCategoryConnectionNode(sc, cr)
                    )
                ).to.exist
            })
        })
    })

    context('database calls', () => {
        const SUBJECT_NODE_QUERY_2_NODES = gql`
            ${SUBJECT_MAIN_FIELDS}

            query($id: ID!, $id2: ID!) {
                subject1: subjectNode(id: $id) {
                    ...subjectMainFields
                }

                subject2: subjectNode(id: $id2) {
                    ...subjectMainFields
                }
            }
        `

        async function subject2Nodes(
            headers: Headers,
            id: string,
            id2: string
        ) {
            const { query } = testClient
            const operation = () =>
                query({
                    query: print(SUBJECT_NODE_QUERY_2_NODES),
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

            await subject2Nodes(
                { authorization: getAdminAuthToken() },
                subjects[0].id,
                subjects[1].id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it('throws an error if id does not exist', async () => {
            await expect(getSubjectNode(NIL_UUID)).to.be.rejected
        })
    })
})
