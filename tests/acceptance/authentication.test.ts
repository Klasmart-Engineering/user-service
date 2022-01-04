import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { createTestConnection } from '../utils/testConnection'
import { makeRequest } from './utils'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createUser } from '../factories/user.factory'
import { customErrors } from '../../src/types/errors/customError'
import { stringInject } from '../../src/utils/stringUtils'

use(chaiAsPromised)

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.authentication', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    // categoriesConnection chosen because it doesn't error
    // without token infomation
    const VALID_WITH_NO_TOKEN_QUERY = `query{
        categoriesConnection(direction: FORWARD) {
            totalCount
        }
    }`

    it('accepts missing tokens', async () => {
        const response = await makeRequest(
            request,
            VALID_WITH_NO_TOKEN_QUERY,
            {}
        )

        expect(response.status).to.eq(200)
        expect(response.body.errors).to.be.undefined
    })

    it('accepts valid tokens and passes them on to resolvers', async () => {
        // this was chosen as it can
        // respond with information that must of
        // been fetched based directly on the
        // token contents
        const CHECK_TOKEN_INFO = `query {
            me {
                user_id
                email
            }
        }`

        const user = await createUser().save()
        const token = generateToken({
            id: user.user_id,
            email: user.email,
            iss: 'calmid-debug',
        })

        const response = await makeRequest(request, CHECK_TOKEN_INFO, {}, token)

        expect(response.status).to.eq(200)
        expect(response.body.errors).to.be.undefined
        expect(response.body.data.me.email).to.eq(user.email!)
        expect(response.body.data.me.user_id).to.eq(user.user_id!)
    })

    it('errors for invalid tokens with correct message', async () => {
        const user = await createUser().save()
        const token = generateToken({
            id: user.user_id,
            email: user.email,
            iss: 'not-a-real-iss',
        })

        const response = await makeRequest(
            request,
            VALID_WITH_NO_TOKEN_QUERY,
            {},
            token
        )

        expect(response.status).to.eq(401)
        expect(response.body.data).to.be.undefined
        expect(response.body.code).to.eq(customErrors.invalid_token.code)
        expect(response.body.message).to.eq(
            stringInject(customErrors.invalid_token.message, {
                reason: 'Unknown authentication token issuer',
            })
        )
    })
})
