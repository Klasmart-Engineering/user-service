import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = require('supertest')(url)

const ME = `
    query {
        me {
            username
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

    it('queries current user information successfully', (done) => {
        request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: ME,
            })
            .expect(200)
            .end((err: any, res: any) => {
                if (err) return done(err)
                expect(res.body.data.me.email).to.equal('joe@gmail.com')
            })

        done()
    })
})
