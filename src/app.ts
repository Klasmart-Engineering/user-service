import express from 'express'
import { Model } from './model'
import cookieParser from 'cookie-parser'
import { graphqlUploadExpress } from 'graphql-upload'
import { createServer } from './utils/createServer'
import { checkIssuerAuthorization } from './token'
import escapeStringRegexp from "escape-string-regexp"

const domain = process.env.DOMAIN || ""
if(!domain) { console.warn("Warning: The DOMAIN enviroment variable was not set") }
const domainRegex = new RegExp(`^https://(.*\\.)?${escapeStringRegexp(domain)}$`)

const routePrefix = process.env.ROUTE_PREFIX || ''

export const initApp = async () => {
    const model = await Model.create()
    const apolloServer = createServer(model)

    const app = express()
    app.use(graphqlUploadExpress({ maxFileSize: 50000, maxFiles: 10 }))
    app.use(cookieParser())
    app.use(express.json())
    app.use(checkIssuerAuthorization)

    apolloServer.applyMiddleware({
        app: app,
        cors: {
            allowedHeaders: ['Authorization', 'Content-Type'],
            credentials: true,
            origin: (origin, callback) => {
				try {
                    if (!origin) { callback(null, false); return }
					const match = origin.match(domainRegex)
					callback(null, Boolean(match))
				} catch (e) {
					console.error(e)
					callback(e)
				}
			},
        },
        path: routePrefix,
    })

    return { expressApp: app, apolloServer }
}
