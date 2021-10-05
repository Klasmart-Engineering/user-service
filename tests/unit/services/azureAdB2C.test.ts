import { use, expect } from 'chai'
import passport from 'passport'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import proxyquire from 'proxyquire'

use(chaiAsPromised)
describe('getAuthenticatedUser', () => {
    const env = process.env
    const passportInitializeStub = sinon.stub()
    const passportUseStub = sinon.stub()
    const passportAzureAdBearerStrategyStub = sinon.stub()
    let userStub = {}
    let infoStub: any
    let azureAdB2C: any
    beforeEach(async () => {
        process.env = {
            ...env,
            AZURE_B2C_ENABLED: 'true',
            AZURE_B2C_TENANT_NAME: 'tenant',
            AZURE_B2C_CLIENT_ID: '123',
            AZURE_B2C_POLICY_NAME: 'pname',
            AZURE_B2C_AUTHORITY: 'auth',
        }
        passportInitializeStub.resolves({})
        passportUseStub.resolves({})
        passportAzureAdBearerStrategyStub.resolves({})
        azureAdB2C = proxyquire('../../../src/services/azureAdB2C', {
            passport: {
                initialize: passportInitializeStub,
                use: passportUseStub,
                authenticate: sinon
                    .stub(passport, 'authenticate')
                    .callsFake((strategy, options, callback) => {
                        callback?.(null, userStub, infoStub)
                    }),
            },
            'passport-azure-ad': {
                BearerStrategy: passportAzureAdBearerStrategyStub,
            },
        })
    })

    afterEach(() => {
        process.env = env
        sinon.restore()
    })
    context('getAuthenticatedUser', () => {
        it('should return user info on successfull authentication', async () => {
            userStub = {}
            infoStub = {
                sub: 'asd',
                iss: 'kk',
                emails: ['abc@s.com'],
            }

            const user = await azureAdB2C.getAuthenticatedUser({})

            sinon.assert.calledOnce(passportInitializeStub)
            sinon.assert.calledOnce(passportUseStub)
            expect(user).to.be.eql(infoStub)
        })
        it('should return invalid token on unsuccessfull authentication', async () => {
            userStub = false

            const user = azureAdB2C.getAuthenticatedUser({})

            await expect(user).to.be.rejectedWith('Invalid token')
        })
    })
})
