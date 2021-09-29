import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import appPackage from '../../package.json'
import { createTestConnection } from '../utils/testConnection'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)

describe('acceptance.app', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    it('fetches app version from package.json successfully', async () => {
        const response = await request.get('/version')

        expect(response.status).to.eq(200)
        expect(response.text).to.equal(`${appPackage.version}`)
    })
})
