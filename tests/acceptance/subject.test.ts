import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Status } from '../../src/entities/status'
import { Subject } from '../../src/entities/subject'
import SubjectsInitializer from '../../src/initializers/subjects'
import { loadFixtures } from '../utils/fixtures'
import {
    createCategories,
    createOrg,
    createPrograms,
    createSubjects,
    deleteSubject,
    ICategoryDetail,
    IProgramDetail,
    ISubjectDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { SUBJECTS_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const categoriesCount = 8
const subjectsCount = 4
const programsCount = 2

let org1Id: string
let categoryIds: string[]
let subjectIds: string[]
let subjects: { id: string; name: string }[]
let systemSubjectsCount = 0

describe('acceptance.subject', () => {
    let connection: Connection

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

        subjects = (await connection.manager.find(Subject)).map((s) => {
            return { id: s.id, name: s.name || '' }
        })

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
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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

        it('queries paginated subjects sorted by system', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBJECTS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'system',
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

        it('queries paginated subjects filtering by organization ID', async () => {
            const organizationId = org1Id
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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
                    query: SUBJECTS_CONNECTION,
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

        context('using cursor', () => {
            it('queries paginated subjects sorted by system in a DESC order', async () => {
                let hasNextPage = true
                let cursor = undefined
                let index = 0
                const totalUsers = subjectsCount + systemSubjectsCount
                const fetchCount = 5

                while (hasNextPage) {
                    const response: any = await request
                        .post('/graphql')
                        .set({
                            ContentType: 'application/json',
                            Authorization: getAdminAuthToken(),
                        })
                        .send({
                            query: SUBJECTS_CONNECTION,
                            variables: {
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: fetchCount,
                                    cursor,
                                },
                                sortArgs: {
                                    field: 'system',
                                    order: 'ASC',
                                },
                            },
                        })

                    const subjectsConnection =
                        response.body.data.subjectsConnection
                    const unseenUsers = totalUsers - index

                    expect(response.status).to.eq(200)
                    expect(subjectsConnection.totalCount).to.eq(totalUsers)
                    expect(subjectsConnection.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < subjectsConnection.edges.length; i++) {
                        expect(subjectsConnection.edges[i].node.system).to.eq(
                            i >= subjectsCount
                        )

                        index++
                    }

                    hasNextPage = subjectsConnection.pageInfo.hasNextPage
                    cursor = subjectsConnection.pageInfo.endCursor
                }
            })

            it('queries paginated subjects sorted by name in a DESC order', async () => {
                let hasNextPage = true
                let cursor = undefined
                let index = 0
                const totalUsers = subjectsCount + systemSubjectsCount
                const fetchCount = 5
                const sortedSubjects = subjects.sort((a, b) => {
                    if (a.name < b.name) {
                        return 1
                    }

                    if (a.name > b.name) {
                        return -1
                    }

                    if (a.id < b.id) {
                        return -1
                    }

                    if (a.id > b.id) {
                        return 1
                    }

                    return 0
                })

                while (hasNextPage) {
                    const response: any = await request
                        .post('/graphql')
                        .set({
                            ContentType: 'application/json',
                            Authorization: getAdminAuthToken(),
                        })
                        .send({
                            query: SUBJECTS_CONNECTION,
                            variables: {
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: fetchCount,
                                    cursor,
                                },
                                sortArgs: {
                                    field: 'name',
                                    order: 'ASC',
                                },
                            },
                        })

                    const subjectsConnection =
                        response.body.data.subjectsConnection
                    const unseenUsers = totalUsers - index

                    expect(response.status).to.eq(200)
                    expect(subjectsConnection.totalCount).to.eq(totalUsers)
                    expect(subjectsConnection.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < subjectsConnection.edges.length; i++) {
                        expect(subjectsConnection.edges[i].node.id).to.eq(
                            sortedSubjects[index].id
                        )

                        index++
                    }

                    hasNextPage = subjectsConnection.pageInfo.hasNextPage
                    cursor = subjectsConnection.pageInfo.endCursor
                }
            })
        })
    })
})
