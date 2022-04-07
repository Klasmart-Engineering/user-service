import supertest from 'supertest'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAdminAuthToken } from '../utils/testConfig'

use(chaiAsPromised)

const url = 'http://localhost:8080'

const request = supertest(url)

describe('API docs', () => {
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
    })
})
