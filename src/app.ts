import cookieParser from 'cookie-parser'
import cors, { CorsOptions } from 'cors'
import escapeStringRegexp from 'escape-string-regexp'
import express from 'express'
import expressPlayground from 'graphql-playground-middleware-express'
import { graphqlUploadExpress } from 'graphql-upload'
import path from 'path'
import appPackage from '../package.json'
import logger, { Logger } from './logging'
import {
    correlationIdMiddleware,
    CORRELATION_ID_HEADER,
    loggerMiddlewareFactory,
} from './middlewares'
import { Model } from './model'
import { validateToken } from './token'
import { createServer } from './utils/createServer'

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

export const ROUTE_PREFIX = process.env.ROUTE_PREFIX ?? ''

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
    app.use(cors(corsOptions))

    // unauthenticated endpoints
    app.get(`${options.routePrefix}/version`, (_, res) => {
        res.status(200).json({
            version: `${appPackage.version}`,
        })
    })

    app.get(`${options.routePrefix}/health`, (_, res) => {
        res.status(200).json({
            status: 'pass',
        })
    })

    // auth check is done here
    // because throwing an error during apollo context creation
    // gives a 400 status code
    app.use(validateToken)

    // authenticated end points

    const viewsPath = path.join(__dirname, '..', 'views')
    app.use(express.static(viewsPath))
    app.set('views', viewsPath)
    app.set('view engine', 'pug')

    app.get(`${options.routePrefix}`, (_, res) => {
        res.render('index', { routePrefix: ROUTE_PREFIX })
    })
    app.get(`${options.routePrefix}/explorer`, (_, res) => {
        res.render('graphiql', { routePrefix: ROUTE_PREFIX })
    })
    app.get(`${options.routePrefix}/playground`, (req, res, next) => {
        expressPlayground({
            endpoint: `${options.routePrefix}/playground`,
        })(req, res, next)
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
