import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'
import appPackage from '../../package.json'
import { TestConnection } from '../utils/testConnection'

use(chaiAsPromised)

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.app', () => {
    it('fetches app version from package.json successfully', async () => {
        const response = await request.get('/version')

        expect(response.status).to.eq(200)
        expect(response.body).to.deep.equal({
            version: `${appPackage.version}`,
        })
    })
})
