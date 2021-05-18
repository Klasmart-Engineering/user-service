import express from 'express'
import { Model } from './model'
import cookieParser from 'cookie-parser'
import { graphqlUploadExpress } from 'graphql-upload'
import { createServer } from './utils/createServer'
import { checkIssuerAuthorization } from './token'

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
            origin: true,
        },
        path: routePrefix,
    })

    return { expressApp: app, apolloServer }
}
