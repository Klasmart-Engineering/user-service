import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { sign } from 'jsonwebtoken'
import { Request } from 'express'
import { generateToken, getNonAdminAuthToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createResponse, createRequest } from 'node-mocks-http'
import { checkToken } from '../../../src/token'

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
        xit('no token passed in', async () => {
            req.headers = { authorization: undefined }
            await expect(checkToken(req)).to.be.rejectedWith(
                'No authentication token'
            )
        })
        xit('malformed token passed in', async () => {
            req.headers = { authorization: 'not_a_token' }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Malformed authentication token'
            )
        })
        xit('issuer has wrong type in token', async () => {
            payload['iss'] = 1

            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Malformed authentication token issuer'
            )
        })
        xit('missing issuer in token', async () => {
            payload = {}
            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Malformed authentication token issuer'
            )
        })
        xit('unknown token issuer', async () => {
            payload['iss'] = 'not-allowed-issuer'
            const token = generateToken(payload)
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'Unknown authentication token issuer'
            )
        })
        xit('bad signature', async () => {
            const token = sign(payload, 'the_wrong_secret', {
                expiresIn: '1800s',
            })
            req.headers = { authorization: token }
            await expect(checkToken(req)).to.be.rejectedWith(
                'invalid signature'
            )
        })
    })

    it('with valid token', async () => {
        const token = generateToken(payload)
        req.headers = { authorization: token }
        await expect(checkToken(req)).to.eventually.have.deep.include(payload)
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
