import { assert } from 'chai'
import createTestSchema from '../../utils/createTestSchema'
import { ApolloServer } from 'apollo-server-express'
import * as sinon from 'sinon'
import { Context } from '../../../src/main'
import { deprecatedLogger } from '../../../src/directives/isDeprecatedLogger'

const originURL = 'http://www.kidsloop.com'

describe('isDeprecatedLogger', () => {
    let testServer: ApolloServer
    let logSpy: sinon.SinonSpy

    before(async () => {
        testServer = new ApolloServer({
            schema: createTestSchema(),
            context: () =>
                (({
                    req: {
                        headers: {
                            origin: originURL,
                            'x-kidsloop-client-name': 'myclient',
                        },
                    },
                } as unknown) as Context),
        })
    })

    after(async () => {
        await testServer.stop()
    })

    beforeEach(() => {
        logSpy = sinon.spy()
        sinon.stub(deprecatedLogger, 'log').callsFake(logSpy)
    })

    afterEach(() => {
        sinon.restore()
    })

    context('when request includes a deprecated field', () => {
        it('should log a warning', async () => {
            const headers = await testServer.executeOperation({
                query: `query MyRequest {
                    getUser {
                        first_name
                        family_name
                        username
                    }
                }`,
            })
            assert(
                logSpy.calledOnceWith(
                    'warn',
                    JSON.stringify({
                        operationType: 'query',
                        operationName: 'MyRequest',
                        deprecatedField: 'username',
                        originURL,
                        kidsloopClientName: 'myclient',
                    })
                )
            )
        })
    })

    context('when request is a deprecated query', () => {
        it('should log a warning', async () => {
            await testServer.executeOperation({
                query: `query MyRequest($user_id: String) {
                    getUserById(user_id: $user_id) {
                        first_name
                    }
                }`,
                variables: { user_id: '123' },
            })
            assert(
                logSpy.calledOnceWith(
                    'warn',
                    JSON.stringify({
                        operationType: 'query',
                        operationName: 'MyRequest',
                        deprecatedField: 'getUserById',
                        originURL,
                        kidsloopClientName: 'myclient',
                    })
                )
            )
        })
    })

    context('when request is a deprecated mutation', () => {
        it('should log a warning', async () => {
            await testServer.executeOperation({
                query: `mutation MyRequest($username: String!) {
                    setUsername(username: $username) {
                        first_name
                        family_name
                    }
                }`,
                variables: { username: '123' },
            })
            assert(
                logSpy.calledOnceWith(
                    'warn',
                    JSON.stringify({
                        operationType: 'mutation',
                        operationName: 'MyRequest',
                        deprecatedField: 'setUsername',
                        originURL,
                        kidsloopClientName: 'myclient',
                    })
                )
            )
        })
    })

    context('when multiple components of a request are deprecated', () => {
        it('should log a warning for each', async () => {
            await testServer.executeOperation({
                query: `query MyRequest {
                    getUser {
                        user_id
                        myOrganization {
                            orgId
                        }
                    }
                }`,
            })
            assert(logSpy.calledTwice)
            assert(
                logSpy.calledWith(
                    'warn',
                    JSON.stringify({
                        operationType: 'query',
                        operationName: 'MyRequest',
                        deprecatedField: 'myOrganization',
                        originURL,
                        kidsloopClientName: 'myclient',
                    })
                )
            )
            assert(
                logSpy.calledWith(
                    'warn',
                    JSON.stringify({
                        operationType: 'query',
                        operationName: 'MyRequest',
                        deprecatedField: 'orgId',
                        originURL,
                        kidsloopClientName: 'myclient',
                    })
                )
            )
        })
    })
})
