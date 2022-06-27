import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { expect, use } from 'chai'
import { makeRequest } from './utils'
import { generateToken, getAPIKeyAuth } from '../utils/testConfig'
import { createUser } from '../factories/user.factory'
import { customErrors } from '../../src/types/errors/customError'
import { stringInject } from '../../src/utils/stringUtils'
import { Grade } from '../../src/entities/grade'
import { Organization } from '../../src/entities/organization'

use(chaiAsPromised)

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.authentication', () => {
    context('tokenAuth', () => {
        // categoriesConnection chosen because it doesn't error
        // without token information
        const VALID_WITH_NO_TOKEN_QUERY = `query{
            categoriesConnection(direction: FORWARD) {
                totalCount
            }
        }`

        it('rejects missing tokens', async () => {
            const response = await makeRequest(
                request,
                VALID_WITH_NO_TOKEN_QUERY,
                {}
            )

            expect(response.status).to.eq(401)
            expect(response.body.code).to.equal('UNAUTHORIZED')
            expect(response.body.message).to.contain(
                'Invalid token provided: No authentication token.'
            )
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
                azure_ad_b2c_id: '123_abc',
            })

            const response = await makeRequest(
                request,
                CHECK_TOKEN_INFO,
                {},
                token
            )

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
                azure_ad_b2c_id: '123_abc',
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

    context('apiKeyAuth', () => {
        const RemoveDuplicateGrades = `mutation {
                    renameDuplicateGrades
                }`

        beforeEach(async () => {
            const organization = new Organization()
            await organization.save()

            for (let i = 0; i < 3; i += 1) {
                const grade = new Grade()
                grade.name = 'testGrade'
                grade.organization = Promise.resolve(organization)
                await grade.save()
            }
        })

        it('accepts APIKeys', async () => {
            const response = await makeRequest(
                request,
                RemoveDuplicateGrades,
                {},
                getAPIKeyAuth()
            )

            expect(response.status).to.eq(200)
            expect(response.body.errors).to.be.undefined
        })

        it('errors for invalid API key with correct message', async () => {
            const response = await makeRequest(
                request,
                RemoveDuplicateGrades,
                {},
                'Bearer IncorrectAPIKey'
            )

            expect(response.status).to.eq(401)
            expect(response.body.data).to.be.undefined

            expect(response.body.code).to.eq(customErrors.invalid_api_key.code)
        })
    })
})
