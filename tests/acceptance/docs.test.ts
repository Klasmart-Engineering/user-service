import supertest from 'supertest'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { customErrors } from '../../src/types/errors/customError'

use(chaiAsPromised)

const url = 'http://localhost:8080'

const request = supertest(url)

describe('API docs', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    describe('GET /', () => {
        context('when authenticated', () => {
            it('returns the API docs landing page', async () => {
                const response = await request.get('/user').set({
                    Authorization: getAdminAuthToken(),
                })
                expect(response.status).to.eq(200)
                expect(response.type).to.eq('text/html')
                expect(response.text).to.contain('documentation')
            })
        })
        context('when non authenticated', () => {
            // todo: unskip when auth token is mandatory
            it.skip('returns 401 status with error message', async () => {
                const response = await request.get('/user')
                expect(response.status).to.eq(401)
                expect(response.body.message).to.contain(
                    customErrors.invalid_token.message
                )
            })
        })
    })

    describe('GET /explorer', () => {
        context('when authenticated', () => {
            it('returns the GraphiQL explorer', async () => {
                const response = await request.get('/user/explorer').set({
                    Authorization: getAdminAuthToken(),
                })
                expect(response.status).to.eq(200)
                expect(response.type).to.eq('text/html')
                expect(response.text).to.contain('graphiql')
            })
        })
        context('when non authenticated', () => {
            // todo: unskip when auth token is mandatory
            it.skip('returns 401 status with error message', async () => {
                const response = await request.get('/user/explorer')
                expect(response.status).to.eq(401)
                expect(response.body.message).to.contain(
                    customErrors.invalid_token.message
                )
            })
        })
    })

    describe('GET /playground', () => {
        context('when authenticated', () => {
            it('returns the GraphQL Playground', async () => {
                const response = await request.get('/user/playground').set({
                    Authorization: getAdminAuthToken(),
                })
                expect(response.status).to.eq(200)
                expect(response.type).to.eq('text/html')
                expect(response.text).to.contain('playground')
            })
        })
        context('when non authenticated', () => {
            // todo: unskip when auth token is mandatory
            it.skip('returns 401 status with error message', async () => {
                const response = await request.get('/user/playground')
                expect(response.status).to.eq(401)
                expect(response.body.message).to.contain(
                    customErrors.invalid_token.message
                )
            })
        })
    })
})
