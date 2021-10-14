import cors, { CorsOptions } from 'cors'
import express from 'express'
import { Model } from './model'
import cookieParser from 'cookie-parser'
import { graphqlUploadExpress } from 'graphql-upload'
import { createServer } from './utils/createServer'
import { checkIssuerAuthorization } from './token'
import escapeStringRegexp from 'escape-string-regexp'
import appPackage from '../package.json'
import logger, { Logger } from './logging'
import {
    correlationIdMiddleware,
    loggerMiddlewareFactory,
    CORRELATION_ID_HEADER,
} from './middlewares'

interface AppOptions {
    routePrefix?: string
    logger?: Logger
}

export const DOMAIN = process.env.DOMAIN || 'kidsloop.net'
if (!DOMAIN) {
    throw Error(`The DOMAIN enviroment variable was not set`)
}
const domainRegex = new RegExp(
    `^https://(.*\\.)?${escapeStringRegexp(DOMAIN)}(:\\d{1,5})?$`
)

const ROUTE_PREFIX = process.env.ROUTE_PREFIX ?? ''

const corsOptions: CorsOptions = {
    allowedHeaders: ['Authorization', 'Content-Type', CORRELATION_ID_HEADER],
    credentials: true,
    maxAge: 60 * 60 * 24, // 1 day
    origin: domainRegex,
}

const defaultExpressOptions: Required<AppOptions> = {
    routePrefix: ROUTE_PREFIX,
    logger,
}

export function createExpressApp(opts: AppOptions = {}): express.Express {
    const options = {
        ...defaultExpressOptions,
        opts,
    }
    const app = express()
    app.use(graphqlUploadExpress({ maxFileSize: 2000000, maxFiles: 1 }))
    app.use(cookieParser())
    app.use(express.json())
    app.use(correlationIdMiddleware)
    app.use(loggerMiddlewareFactory(options.logger))
    app.use(checkIssuerAuthorization)
    app.use(cors(corsOptions))

    app.get(`${options.routePrefix}/health`, (req, res) => {
        res.status(200).json({
            status: 'pass',
        })
    })

    app.get(`${options.routePrefix}/version`, (req, res) => {
        res.status(200).json({
            version: `${appPackage.version}`,
        })
    })
    return app
}

export const initApp = async () => {
    const model = await Model.create()
    const apolloServer = await createServer(model)
    await apolloServer.start()

    const app = createExpressApp({ routePrefix: ROUTE_PREFIX })

    apolloServer.applyMiddleware({
        app: app,
        cors: false,
        path: ROUTE_PREFIX,
    })

    return { expressApp: app, apolloServer }
}
