import supertest from 'supertest'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'

use(chaiAsPromised)

const url = 'http://localhost:8080'

const request = supertest(url)

describe('acceptance.healthcheck', () => {
    // This db connection code is needed for
    // the acceptance tests to compile,
    // even though this test does no db work.

    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    it('fetches health status', async () => {
        const response = await request.get('/.well-known/apollo/server-health')
        expect(response.status).to.eq(200)
    })
})
