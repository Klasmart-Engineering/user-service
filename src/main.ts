import './utils/dotenv'
import 'newrelic' // Must be imported as early as possible
import { initApp } from './app'
import * as Sentry from '@sentry/node'
import { UserPermissions } from './permissions/userPermissions'
import express from 'express'
import { IDataLoaders } from './loaders/setup'
import logger from './logging'
import { TokenPayload } from './token'
import { getEnvVar } from './config/config'
import { reportError } from './utils/resolvers/errors'
import { saveCodeCoverage } from './utils/fileUtils'

const port = getEnvVar('PORT', '8080')

export interface Context {
    token: TokenPayload | undefined
    res: express.Response
    req: express.Request
    permissions: UserPermissions
    loaders: IDataLoaders
    complexity?: { limit: number; score: number }
}

Sentry.init({
    dsn:
        'https://b78d8510ecce48dea32a0f6a6f345614@o412774.ingest.sentry.io/5388815',
    environment: getEnvVar('NODE_ENV', 'not-specified'),
    release: 'kidsloop-users-gql@' + getEnvVar('npm_package_version'),
})

process.on('SIGINT', gracefulExit)
process.on('SIGTERM', gracefulExit)

function gracefulExit(code: string) {
    logger.info(`${code} received..., exiting`)
    // We need this for acceptance tests
    // using the signal as an indicator that they have finished running
    saveCodeCoverage()
    process.exit()
}

initApp()
    .then((app) => {
        app.expressApp.listen(port, () => {
            logger.info(
                '🌎 Server ready at http://localhost:%s%s',
                port,
                app.apolloServer.graphqlPath
            )
        })
    })
    .catch((e) => {
        Sentry.captureException(e)
        reportError(e)
        process.exit(-1)
    })
