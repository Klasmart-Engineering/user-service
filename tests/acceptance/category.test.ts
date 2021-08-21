import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Category } from '../../src/entities/category'
import { Status } from '../../src/entities/status'
import CategoriesInitializer from '../../src/initializers/categories'
import { loadFixtures } from '../utils/fixtures'
import {
    ISubcategoryDetail,
    ICategoryDetail,
    ISubjectDetail,
    IProgramDetail,
    createOrg,
    createSubcategories,
    createCategories,
    createSubjects,
    createPrograms,
    deleteCategory,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { CATEGORIES_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

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
let systemCategoriesCount = 0

describe('acceptance.category', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await CategoriesInitializer.run()

        const subcategoryDetails: ISubcategoryDetail[] = []
        const categoryDetails: ICategoryDetail[] = []
        const subjectDetails: ISubjectDetail[] = []
        const programDetails: IProgramDetail[] = []

        systemCategoriesCount = await connection.manager.count(Category, {
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

        await deleteCategory(categoryIds[1], getAdminAuthToken())
    })

    context('categoriesConnection', () => {
        it('queries paginated categories', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(
                categoriesCount + systemCategoriesCount
            )
        })

        it('queries paginated categories sorted by ID', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                })

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(
                categoriesCount + systemCategoriesCount
            )
        })

        it('queries paginated categories sorted by name', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'name',
                            order: 'DESC',
                        },
                    },
                })

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(
                categoriesCount + systemCategoriesCount
            )
        })

        it('queries paginated categories filtering by organization ID', async () => {
            const organizationId = org1Id
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
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

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(categoriesCount)
        })

        it('queries paginated categories filtering by status', async () => {
            const status = Status.INACTIVE
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
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

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(1)
        })

        it('queries paginated categories filtering by system', async () => {
            const system = true
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
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

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(
                systemCategoriesCount
            )
        })
    })
})
