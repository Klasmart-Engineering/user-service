import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Category } from '../../src/entities/category'
import CategoriesInitializer from '../../src/initializers/categories'
import { loadFixtures } from '../utils/fixtures'
import {
    createCategories,
    createOrg,
    ICategoryDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { CATEGORIES_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

let systemcategoriesCount = 0
const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const categoriesCount = 12

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
        await loadFixtures('users', connection)

        const categoriesDetails: ICategoryDetail[] = []
        const createOrgResponse = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrgData =
            createOrgResponse.body.data.user.createOrganization

        const orgId = createOrgData.organization_id

        for (let i = 1; i <= categoriesCount; i++) {
            categoriesDetails.push({
                name: `category ${i}`,
                system: true,
            })
        }

        for (let i = 1; i <= categoriesCount; i++) {
            categoriesDetails.push({
                name: `category b${i}`,
                system: false,
            })
        }

        await createCategories(orgId, categoriesDetails, getAdminAuthToken())

        systemcategoriesCount = await connection.manager.count(Category, {
            where: { system: true },
        })
    })

    context('categoriesConnection', () => {
        async function makeQuery(pageSize: any) {
            return await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CATEGORIES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        directionArgs: {
                            count: pageSize,
                        },
                    },
                })
        }

        it('queries paginated categories', async () => {
            const pageSize = 5

            const response = await makeQuery(pageSize)

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(
                systemcategoriesCount
            )
            expect(categoriesConnection.edges.length).to.equal(pageSize)
        })

        it('fails validation', async () => {
            const pageSize = 'not_a_number'
            const response = await makeQuery(pageSize)

            expect(response.status).to.eq(400)
            expect(response.body.errors.length).to.equal(1)
            const message = response.body.errors[0].message
            expect(message)
                .to.be.a('string')
                .and.satisfy((msg: string) =>
                    msg.startsWith(
                        'Variable "$directionArgs" got invalid value "not_a_number" at "directionArgs.count"; Expected type "PageSize".'
                    )
                )
        })
    })
})
