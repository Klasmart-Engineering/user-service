import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Subcategory } from '../../src/entities/subcategory'
import { SUBCATEGORIES_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { expect } from 'chai'

const url = 'http://localhost:8080'
const request = supertest(url)

describe('acceptance.subcategory', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('subcategoriesConnection', () => {
        let subcategoriesCount: number

        beforeEach(async () => {
            subcategoriesCount = await Subcategory.count()
        })

        context('when data is requested in a correct way', () => {
            it('should response with status 200', async () => {
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
                        },
                    })

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
})
