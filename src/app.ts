import cookieParser from 'cookie-parser'
import cors, { CorsOptions } from 'cors'
import escapeStringRegexp from 'escape-string-regexp'
import express from 'express'
import expressPlayground from 'graphql-playground-middleware-express'
import { graphqlUploadExpress } from 'graphql-upload'
import {
    correlationMiddleware,
    DEFAULT_CORRELATION_HEADER,
} from '@kl-engineering/kidsloop-nodejs-logger'
import path from 'path'
import appPackage from '../package.json'
import { Model } from './model'
import { validateToken } from './token'
import { createServer } from './utils/createServer'
import { getEnvVar } from './config/config'
import { reportError } from './utils/resolvers/errors'

interface AppOptions {
    routePrefix?: string
}

export const DOMAIN = getEnvVar('DOMAIN', 'kidsloop.net')
if (!DOMAIN) {
    throw Error(`The DOMAIN environment variable was not set`)
}
const domainRegex = new RegExp(
    `^https://(.*\\.)?${escapeStringRegexp(DOMAIN)}(:\\d{1,5})?$`
)

export const ROUTE_PREFIX = getEnvVar('ROUTE_PREFIX', '')!
export const REQUEST_TIMEOUT_MS = parseInt(
    getEnvVar('REQUEST_TIMEOUT_MS', '300000')!
)

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
    app.use(cors(corsOptions))

    const viewsPath = path.join(__dirname, '..', 'views')
    app.use(express.static(viewsPath))
    app.set('views', viewsPath)
    app.set('view engine', 'pug')

    app.use((req, res, next) => {
        res.setTimeout(REQUEST_TIMEOUT_MS, function () {
            reportError(new Error('Request timed out'), {
                query: req.body.query,
            })
        })
        next()
    })

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
    app.get(`${options.routePrefix}`, docsAreEnabled, (_, res) => {
        res.render('index', { routePrefix: ROUTE_PREFIX })
    })
    app.get(`${options.routePrefix}/explorer`, docsAreEnabled, (_, res) => {
        res.render('graphiql', { routePrefix: ROUTE_PREFIX })
    })
    app.get(
        `${options.routePrefix}/playground`,
        docsAreEnabled,
        (req, res, next) => {
            expressPlayground({
                endpoint: `${options.routePrefix}/playground`,
            })(req, res, next)
        }
    )

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

export function docsAreEnabled(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    if (
        getEnvVar('ENABLE_PAGE_DOCS') === '1' ||
        process.env.NODE_ENV === 'development'
    ) {
        next()
    } else {
        res.status(403).send('Docs are disabled on this server.')
    }
}
