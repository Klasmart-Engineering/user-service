import cookieParser from 'cookie-parser'
import cors, { CorsOptions } from 'cors'
import escapeStringRegexp from 'escape-string-regexp'
import express from 'express'
import expressPlayground from 'graphql-playground-middleware-express'
import { graphqlUploadExpress } from 'graphql-upload'
import {
    correlationMiddleware,
    DEFAULT_CORRELATION_HEADER,
} from 'kidsloop-nodejs-logger'
import path from 'path'
import appPackage from '../package.json'
import { Model } from './model'
import { checkIssuerAuthorization, validateToken } from './token'
import { createServer } from './utils/createServer'

interface AppOptions {
    routePrefix?: string
}

export const DOMAIN = process.env.DOMAIN || 'kidsloop.net'
if (!DOMAIN) {
    throw Error(`The DOMAIN environment variable was not set`)
}
const domainRegex = new RegExp(
    `^https://(.*\\.)?${escapeStringRegexp(DOMAIN)}(:\\d{1,5})?$`
)

export const ROUTE_PREFIX = process.env.ROUTE_PREFIX ?? ''

const corsOptions: CorsOptions = {
    allowedHeaders: [
        'Authorization',
        'Content-Type',
        DEFAULT_CORRELATION_HEADER,
    ],
    credentials: true,
    maxAge: 60 * 60 * 24, // 1 day
    origin: domainRegex,
}

const defaultExpressOptions: Required<AppOptions> = {
    routePrefix: ROUTE_PREFIX,
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
    app.use(correlationMiddleware())

    app.use(checkIssuerAuthorization)
    app.use(cors(corsOptions))

    const viewsPath = path.join(__dirname, '..', 'views')
    app.use(express.static(viewsPath))
    app.set('views', viewsPath)
    app.set('view engine', 'pug')

    app.get(`${options.routePrefix}`, validateToken, (_, res) => {
        res.render('index', { routePrefix: ROUTE_PREFIX })
    })
    app.get(`${options.routePrefix}/explorer`, validateToken, (_, res) => {
        res.render('graphiql', { routePrefix: ROUTE_PREFIX })
    })
    app.get(
        `${options.routePrefix}/playground`,
        validateToken,
        (req, res, next) => {
            expressPlayground({
                endpoint: `${options.routePrefix}/playground`,
            })(req, res, next)
        }
    )

    app.get(`${options.routePrefix}/health`, (_, res) => {
        res.status(200).json({
            status: 'pass',
        })
    })

    app.get(`${options.routePrefix}/version`, (_, res) => {
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
