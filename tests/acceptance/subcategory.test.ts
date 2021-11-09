import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Subcategory } from '../../src/entities/subcategory'
import {
    SUBCATEGORIES_CONNECTION,
    SUBCATEGORY_NODE,
} from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { expect } from 'chai'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { NIL_UUID } from '../utils/database'

const url = 'http://localhost:8080'
const request = supertest(url)

async function makeConnectionQuery() {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: print(SUBCATEGORIES_CONNECTION),
            variables: {
                direction: 'FORWARD',
            },
        })
}

const makeNodeQuery = async (id: string) => {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: print(SUBCATEGORY_NODE),
            variables: {
                id,
            },
        })
}

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
    })

    context('subcategoriesConnection', () => {
        let subcategoriesCount: number

        beforeEach(async () => {
            subcategoriesCount = await Subcategory.count()
        })

        context('when data is requested in a correct way', () => {
            it('should response with status 200', async () => {
                const response = await makeConnectionQuery()
                const subcategoriesConnection =
                    response.body.data.subcategoriesConnection

                expect(response.status).to.eq(200)
                expect(subcategoriesConnection.totalCount).to.equal(
                    subcategoriesCount
                )
            })
        })

        context('when data is requested in an incorrect way', () => {
            it('should response with status 400', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(SUBCATEGORIES_CONNECTION),
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                byStatus: {
                                    operator: 'eq',
                                    value: 'available',
                                },
                            },
                        },
                    })

                const errors = response.body.errors
                const data = response.body.data

                expect(response.status).to.eq(400)
                expect(errors).to.exist
                expect(data).to.be.undefined
            })
        })
    })

    context('subcategoryNode', () => {
        context('when requested subcategory exists', () => {
            it('should respond succesfully', async () => {
                const subcategoryResponse = await makeConnectionQuery()
                const subcategoriesEdges =
                    subcategoryResponse.body.data.subcategoriesConnection.edges
                const subcategoryId = subcategoriesEdges[0].node.id
                const response = await makeNodeQuery(subcategoryId)
                const subcategoryNode = response.body.data.subcategoryNode

                expect(response.status).to.eq(200)
                expect(subcategoryNode.id).to.equal(subcategoryId)
            })
        })

        context('when requested subcategory does not exists', () => {
            it('should respond with errors', async () => {
                const response = await makeNodeQuery(NIL_UUID)
                const errors = response.body.errors
                const subcategoryNode = response.body.data.subcategoryNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(subcategoryNode).to.be.null
            })
        })
    })
})
