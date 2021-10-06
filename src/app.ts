import express from 'express'
import { Model } from './model'
import cookieParser from 'cookie-parser'
import { graphqlUploadExpress } from 'graphql-upload'
import { createServer } from './utils/createServer'
import { checkIssuerAuthorization } from './token'
import escapeStringRegexp from 'escape-string-regexp'
import appPackage from '../package.json'

const domain = process.env.DOMAIN || ''
if (!domain) {
    throw Error(`The DOMAIN enviroment variable was not set`)
}
const domainRegex = new RegExp(
    `^https://(.*\\.)?${escapeStringRegexp(domain)}(:\\d{1,5})?$`
)

const routePrefix = process.env.ROUTE_PREFIX || ''

export const initApp = async () => {
    const model = await Model.create()
    const apolloServer = await createServer(model)
    await apolloServer.start()

    const app = express()
    app.use(graphqlUploadExpress({ maxFileSize: 2000000, maxFiles: 1 }))
    app.use(cookieParser())
    app.use(express.json())
    app.use(checkIssuerAuthorization)
    app.get(`${routePrefix}/health`, (req, res) => {
        res.status(200).json({
            status: 'pass',
        })
    })
    apolloServer.applyMiddleware({
        app: app,
        cors: {
            allowedHeaders: ['Authorization', 'Content-Type'],
            credentials: true,
            origin: (origin, callback) => {
                try {
                    if (!origin) {
                        callback(null, false)
                        return
                    }
                    const match = origin.match(domainRegex)
                    callback(null, Boolean(match))
                } catch (e) {
                    console.error(e)
                    if (e instanceof Error || e === null) {
                        callback(e)
                    } else {
                        throw e
                    }
                }
            },
        },
        path: routePrefix,
    })
    app.get('/version', (req, res) => {
        res.status(200).send(appPackage.version)
    })
    return { expressApp: app, apolloServer }
}
