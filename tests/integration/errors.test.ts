import { ApolloError } from 'apollo-server-core'
import { ApolloServer, ExpressContext } from 'apollo-server-express'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createServer } from '../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { nonExistingQuery } from '../utils/operations/errorOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

use(chaiAsPromised)

describe('errors', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let server: ApolloServer<ExpressContext>
    let env = {}

    before(async () => {
        connection = await createTestConnection()
        server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
        env = process.env
    })

    after(async () => {
        await connection?.close()
    })

    context('when environment is development', () => {
        it('should show stacktrace in errors', async () => {
            try {
                await nonExistingQuery(testClient, {
                    authorization: getAdminAuthToken(),
                })
            } catch (error) {
                const apolloError = error as ApolloError
                const parsedError = JSON.parse(apolloError.message)
                const errors = parsedError.errors

                errors.forEach((err: ApolloError) => {
                    expect(err.extensions.exception).to.exist
                })
            }
        })
    })

    context('when environment is not development', () => {
        beforeEach(async () => {
            process.env = { ...env, NODE_ENV: 'not-development' }
            server = await createServer(new Model(connection))
            testClient = await createTestClient(server)
        })

        afterEach(() => {
            process.env = env
        })

        it('should not show stacktrace in errors', async () => {
            try {
                await nonExistingQuery(testClient, {
                    authorization: getAdminAuthToken(),
                })
            } catch (error) {
                const apolloError = error as ApolloError
                const parsedError = JSON.parse(apolloError.message)
                const errors = parsedError.errors

                errors.forEach((err: ApolloError) => {
                    expect(err.extensions.exception).to.not.exist
                })
            }
        })
    })
})
