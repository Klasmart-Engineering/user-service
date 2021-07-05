import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import supertest from 'supertest'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)

const ME = `
    query {
        me {
            email
        }
    }
`

describe('acceptance.user', () => {
    let connection: Connection
    before(async () => {
        connection = await createTestConnection()
        await loadFixtures('users', connection)
    })
    after(async () => {
        await connection?.close()
    })
    it('queries current user information successfully', async () => {
        const response = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: ME,
            })

        expect(response.status).to.eq(200)
        expect(response.body.data.me.email).to.equal('joe@gmail.com')
    })
})
