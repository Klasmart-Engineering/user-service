import supertest from 'supertest'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

const url = 'http://localhost:8080'

const request = supertest(url)

describe('acceptance.healthcheck', () => {
    it('fetches health status', async () => {
        const response = await request.get('/user/health')
        expect(response.status).to.eq(200)
    })
})
