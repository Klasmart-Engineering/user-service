import { expect, use } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Status } from '../../src/entities/status'
import { Subject } from '../../src/entities/subject'
import SubjectsInitializer from '../../src/initializers/subjects'
import { loadFixtures } from '../utils/fixtures'
import {
    createCategories,
    createOrg,
    createSubjects,
    deleteSubject,
    ICategoryDetail,
    ISubjectDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { SUBJECTS_CONNECTION, SUBJECT_NODE } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { SubjectConnectionNode } from '../../src/types/graphQL/subject'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { NIL_UUID } from '../utils/database'
import { makeRequest } from './utils'

interface ISubjectEdge {
    node: SubjectConnectionNode
}

const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const categoriesCount = 8
const subjectsCount = 4
const programsCount = 2

let org1Id: string
let categoryIds: string[]
let subjectIds: string[]
let systemSubjectsCount = 0

use(deepEqualInAnyOrder)

describe('acceptance.subject', () => {
    let connection: Connection

    async function makeConnectionQuery(pageSize: number) {
        return makeRequest(
            request,
            print(SUBJECTS_CONNECTION),
            {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
            },
            getAdminAuthToken()
        )
    }

    async function makeNodeQuery(id: string) {
        return makeRequest(
            request,
            print(SUBJECT_NODE),
            { id },
            getAdminAuthToken()
        )
    }

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await SubjectsInitializer.run()
        const categoryDetails: ICategoryDetail[] = []
        const subjectDetails: ISubjectDetail[] = []

        systemSubjectsCount = await connection.manager.count(Subject, {
            where: { system: true },
        })

        // Creating users
        await loadFixtures('users', connection)

        // Creating Org1
        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        org1Id = createOrg1Data.organization_id

        // Creating Categories
        for (let i = 0; i < categoriesCount; i++) {
            categoryDetails.push({
                name: `category ${i + 1}`,
            })
        }

        const createCategoriesResponse = await createCategories(
            org1Id,
            categoryDetails,
            getAdminAuthToken()
        )

        const createCategoriesData =
            createCategoriesResponse.body.data.organization
                .createOrUpdateCategories

        categoryIds = createCategoriesData.map(
            (c: { id: string; name: string; system: boolean }) => c.id
        )

        // Creating Subjects
        for (let i = 0; i < subjectsCount; i++) {
            const index = i * (categoriesCount / subjectsCount)

            subjectDetails.push({
                name: `subject ${i + 1}`,
                categories: [categoryIds[index], categoryIds[index + 1]],
            })
        }

        const createSubjectsResponse = await createSubjects(
            org1Id,
            subjectDetails,
            getAdminAuthToken()
        )

        const createSubjectsData =
            createSubjectsResponse.body.data.organization.createOrUpdateSubjects

        subjectIds = createSubjectsData.map(
            (s: { id: string; name: string; system: boolean }) => s.id
        )

        await deleteSubject(subjectIds[1], getAdminAuthToken())
    })

    context('subjectsConnection', () => {
        it('queries paginated subjects', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(
                subjectsCount + systemSubjectsCount
            )
        })

        it('queries paginated subjects sorted by ID', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(
                subjectsCount + systemSubjectsCount
            )
        })

        it('queries paginated subjects sorted by name', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'name',
                            order: 'DESC',
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(
                subjectsCount + systemSubjectsCount
            )
        })

        it('queries paginated subjects filtering by organization ID', async () => {
            const organizationId = org1Id
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(subjectsCount)
        })

        it('queries paginated subjects filtering by status', async () => {
            const status = Status.INACTIVE
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            status: {
                                operator: 'eq',
                                value: status,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(1)
        })

        it('queries paginated subjects filtering by system', async () => {
            const system = true
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            system: {
                                operator: 'eq',
                                value: system,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(systemSubjectsCount)
        })

        it('queries paginated subjects filtering by id', async () => {
            const subjectId = subjectIds[0]
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            id: {
                                operator: 'eq',
                                value: subjectId,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(1)
        })

        it('queries paginated subjects filtering by name', async () => {
            const search = '2'
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            name: {
                                operator: 'contains',
                                value: search,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(1)
        })

        it('queries paginated subjects filtering by categories', async () => {
            const categoryId = categoryIds[0]
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            categoryId: {
                                operator: 'eq',
                                value: categoryId,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.be.gte(1)
        })
    })

    context('subjectNode', () => {
        let subjects: ISubjectEdge[]

        beforeEach(async () => {
            const subjectsResponse = await makeConnectionQuery(10)
            subjects = subjectsResponse.body.data.subjectsConnection.edges
        })

        context('when requested subject exists', () => {
            it('responds succesfully', async () => {
                const subject = subjects[0].node
                const response = await makeNodeQuery(subject.id)
                const subjectNode = response.body.data.subjectNode

                expect(response.status).to.eq(200)
                expect(subjectNode.id).to.equal(subject.id)
                expect(subjectNode.name).to.equal(subject.name)
                expect(subjectNode.status).to.equal(subject.status)
                expect(subjectNode.system).to.equal(subject.system)

                const subjectCategories = subject.categories
                const subjectNodeCategories = subjectNode.categories

                expect(subjectNodeCategories).to.deep.equalInAnyOrder(
                    subjectCategories
                )
            })
        })

        context('when requested subject does not exists', () => {
            it('responds with errors', async () => {
                const subjectId = NIL_UUID
                const response = await makeNodeQuery(subjectId)
                const subjectNode = response.body.data.subjectNode
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(subjectNode).to.be.null
                expect(errors).to.exist
            })
        })
    })
})
