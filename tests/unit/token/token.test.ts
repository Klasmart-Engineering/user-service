import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { sign } from 'jsonwebtoken'
import { Request } from 'express'
import { generateToken, getNonAdminAuthToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createResponse, createRequest } from 'node-mocks-http'
import { checkAPIKey, checkToken } from '../../../src/token'

use(chaiAsPromised)

describe('Check Token', () => {
    // don't use the TokenPayload type here
    // because for some tests we want to use deliberately wrong type values
    let payload: { [key: string]: any }
    const req = {
        headers: {},
        cookies: {},
    } as Request
    beforeEach(() => {
        payload = {
            id: 'fcf922e5-25c9-5dce-be9f-987a600c1356',
            email: 'billy@gmail.com',
            given_name: 'Billy',
            family_name: 'Bob',
            name: 'Billy Bob',
            iss: 'calmid-debug',
        }
    })

    context('throw errors when validation fails when', () => {
        // This test is temporarily disabled. See https://calmisland.atlassian.net/browse/AD-1810
        xit('no token passed in', async () => {
            req.headers = { authorization: undefined }
            await expect(checkToken(req)).to.be.rejectedWith(
                'No authentication token'
            )
        })
        it('malformed token passed in', async () => {
            req.headers = { authorization: 'not_a_token' }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Malformed authentication token'
            )
        })
        it('issuer has wrong type in token', async () => {
            payload['iss'] = 1

            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Malformed authentication token issuer'
            )
        })
        it('missing issuer in token', async () => {
            payload = {}
            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Malformed authentication token issuer'
            )
        })
        it('unknown token issuer', async () => {
            payload['iss'] = 'not-allowed-issuer'
            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Unknown authentication token issuer'
            )
        })
        it('bad signature', async () => {
            const token = sign(payload, 'the_wrong_secret', {
                expiresIn: '1800s',
            })
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'invalid signature'
            )
        })
    })

    context('succeeds', () => {
        it('with valid token', async () => {
            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.eventually.have.deep.include(
                payload
            )
        })

        // This test is temporarily included, see https://calmisland.atlassian.net/browse/AD-1810
        it('with missing token', async () => {
            req.headers = { authorization: undefined }
            await expect(checkToken(req)).to.eventually.eq(undefined)
        })
    })

    context('when API key is used for authentication', () => {
        beforeEach(() => {
            process.env = {
                USER_SERVICE_API_KEY: 'test-api-token',
            }
        })

        it('with valid and matching API Key', () => {
            req.headers = { authorization: 'Bearer test-api-token' }
            expect(checkAPIKey(req.headers.authorization!)).to.be.true
        })

        it('with non-matching API Key', () => {
            req.headers = { authorization: 'Bearer different-test-api-token' }
            const checkAPIKeyFunc = function () {
                checkAPIKey(req.headers.authorization!)
            }
            expect(checkAPIKeyFunc).to.throw(Error, 'Invalid API Key')
        })

        it('with invalid format (i.e. no bearer prefix) API Key', () => {
            req.headers = { authorization: 'invalid-test-api-token' }
            expect(checkAPIKey(req.headers.authorization!)).to.be.false
        })
    })

    context('email normalization', () => {
        it('removes leading and trailing spaces', async () => {
            const token = generateToken(payload)
            req.headers = { authorization: token }
            payload.email = ' ' + payload.email + ' '
            const checkedToken = (await checkToken(req))!
            expect(checkedToken.email).to.eq(payload.email.trim())
        })
        it('NFKC unicode normalization', async () => {
            const originalEmail = payload.email
            // based on https://unicode.org/reports/tr15/
            // specificly the first example of
            // https://unicode.org/reports/tr15/images/UAX15-NormFig6.jpg
            const beforeNFKCNormalization = '\uFB01'
            const afterNFKCNormalization = '\u0066\u0069'
            payload.email = payload.email + beforeNFKCNormalization
            const token = generateToken(payload)
            req.headers = { authorization: token }
            const checkedToken = (await checkToken(req))!
            expect(checkedToken.email).to.eq(
                originalEmail + afterNFKCNormalization
            )
        })
    })
})
