import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Status } from '../../src/entities/status'
import { Subcategory } from '../../src/entities/subcategory'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { SubcategoryConnectionNode } from '../../src/types/graphQL/subcategoryConnectionNode'
import { loadFixtures } from '../utils/fixtures'
import {
    createCategories,
    createOrg,
    createPrograms,
    createSubcategories,
    createSubjects,
    deleteSubcategory,
    ICategoryDetail,
    IProgramDetail,
    ISubcategoryDetail,
    ISubjectDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { SUBCATEGORIES_CONNECTION } from '../utils/operations/modelOps'
import { getSystemRoleIds } from '../utils/operations/organizationOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

interface ISubcategoryEdge {
    node: SubcategoryConnectionNode
}

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const subcategoriesCount = 16
const categoriesCount = 8
const subjectsCount = 4
const programsCount = 2

let org1Id: string
let subcategoryIds: string[]
let categoryIds: string[]
let subjectIds: string[]
let programIds: string[]
let systemSubcategoriesCount = 0

describe('acceptance.subcategory', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await SubcategoriesInitializer.run()
        const subcategoryDetails: ISubcategoryDetail[] = []
        const categoryDetails: ICategoryDetail[] = []
        const subjectDetails: ISubjectDetail[] = []
        const programDetails: IProgramDetail[] = []

        systemSubcategoriesCount = await connection.manager.count(Subcategory, {
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

        // Creating Subcategories
        for (let i = 0; i < subcategoriesCount; i++) {
            subcategoryDetails.push({
                name: `subcategory ${i + 1}`,
            })
        }

        const createSubcategoriesResponse = await createSubcategories(
            org1Id,
            subcategoryDetails,
            getAdminAuthToken()
        )

        const createSubcategoriesData =
            createSubcategoriesResponse.body.data.organization
                .createOrUpdateSubcategories

        subcategoryIds = createSubcategoriesData.map(
            (s: { id: string; name: string; system: boolean }) => s.id
        )

        // Creating Categories
        for (let i = 0; i < categoriesCount; i++) {
            const index = i * (subcategoriesCount / categoriesCount)
            categoryDetails.push({
                name: `category ${i + 1}`,
                subcategories: [
                    subcategoryIds[index],
                    subcategoryIds[index + 1],
                ],
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
                name: `category ${i + 1}`,
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

        // Creating Programs
        for (let i = 0; i < programsCount; i++) {
            const index = i * (subjectsCount / programsCount)
            programDetails.push({
                name: `category ${i + 1}`,
                subjects: [subjectIds[index], subjectIds[index + 1]],
            })
        }

        const createProgramsResponse = await createPrograms(
            org1Id,
            programDetails,
            getAdminAuthToken()
        )

        const createProgramsData =
            createProgramsResponse.body.data.organization.createOrUpdatePrograms

        programIds = createProgramsData.map(
            (p: { id: string; name: string; system: boolean }) => p.id
        )

        await deleteSubcategory(subcategoryIds[1], getAdminAuthToken())
    })

    context('subcategoriesConnection', () => {
        it('queries paginated subcategories', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBCATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const subcategoriesConnection =
                response.body.data.subcategoriesConnection

            expect(response.status).to.eq(200)
            expect(subcategoriesConnection.totalCount).to.equal(
                subcategoriesCount + systemSubcategoriesCount
            )
        })

        it('queries paginated subcategories sorted by ID', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBCATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                })

            const subcategoriesConnection =
                response.body.data.subcategoriesConnection

            expect(response.status).to.eq(200)
            expect(subcategoriesConnection.totalCount).to.equal(
                subcategoriesCount + systemSubcategoriesCount
            )
        })

        it('queries paginated subcategories sorted by name', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBCATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'name',
                            order: 'DESC',
                        },
                    },
                })

            const subcategoriesConnection =
                response.body.data.subcategoriesConnection

            expect(response.status).to.eq(200)
            expect(subcategoriesConnection.totalCount).to.equal(
                subcategoriesCount + systemSubcategoriesCount
            )
        })

        it('queries paginated subcategories filtering by organization ID', async () => {
            const organizationId = org1Id
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBCATEGORIES_CONNECTION,
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

            const subcategoriesConnection =
                response.body.data.subcategoriesConnection

            expect(response.status).to.eq(200)
            expect(subcategoriesConnection.totalCount).to.equal(
                subcategoriesCount
            )
        })

        it('queries paginated subcategories filtering by status', async () => {
            const status = Status.INACTIVE
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBCATEGORIES_CONNECTION,
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

            const subcategoriesConnection =
                response.body.data.subcategoriesConnection

            expect(response.status).to.eq(200)
            expect(subcategoriesConnection.totalCount).to.equal(1)
        })

        it('queries paginated subcategories filtering by system', async () => {
            const system = true
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: SUBCATEGORIES_CONNECTION,
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

            const subcategoriesConnection =
                response.body.data.subcategoriesConnection

            expect(response.status).to.eq(200)
            expect(subcategoriesConnection.totalCount).to.equal(
                systemSubcategoriesCount
            )
        })
    })
})
