import './utils/dotenv'
import 'newrelic' // Must be imported as early as possible
import { initApp } from './app'
import * as Sentry from '@sentry/node'
import { UserPermissions } from './permissions/userPermissions'
import express from 'express'
import { IDataLoaders } from './loaders/setup'
import logger from './logging'
import { TokenPayload } from './token'
import { KLLogger, NewRelicLogDeliveryAgent } from 'kidsloop-nodejs-logger'

NewRelicLogDeliveryAgent.initialize()
NewRelicLogDeliveryAgent.configure({})

const port = process.env.PORT || 8080

export interface Context {
    token: TokenPayload
    res: express.Response
    req: express.Request
    logger: KLLogger
    permissions: UserPermissions
    loaders: IDataLoaders
    complexity?: { limit: number; score: number }
}

Sentry.init({
    dsn:
        'https://b78d8510ecce48dea32a0f6a6f345614@o412774.ingest.sentry.io/5388815',
    environment: process.env.NODE_ENV || 'not-specified',
    release: 'kidsloop-users-gql@' + process.env.npm_package_version,
})

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
        logger.error(e)
        process.exit(-1)
    })
