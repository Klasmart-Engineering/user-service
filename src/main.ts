import express from 'express'
import * as Sentry from '@sentry/node'
import WebSocket from 'ws'
import { Model } from './model'
import cookieParser from 'cookie-parser'
import * as dotenv from 'dotenv'
import { createServer } from './utils/createServer'
import { UserPermissions } from './permissions/userPermissions'

dotenv.config({ path: __dirname + '/../.env' })

const routePrefix = process.env.ROUTE_PREFIX || ''

Sentry.init({
    dsn:
        'https://b78d8510ecce48dea32a0f6a6f345614@o412774.ingest.sentry.io/5388815',
    environment: process.env.NODE_ENV || 'not-specified',
    release: 'kidsloop-users-gql@' + process.env.npm_package_version,
})

export interface Context {
    token?: any
    sessionId?: string
    res?: any
    req?: any
    websocket?: WebSocket
    permissions: UserPermissions
}

async function main() {
    try {
        const model = await Model.create()
        const server = createServer(model)

        const app = express()
        app.use(cookieParser())
        server.applyMiddleware({
            app,
            cors: {
                allowedHeaders: ['Authorization', 'Content-Type'],
                credentials: true,
                origin: true,
            },
            path: routePrefix,
        })
        const port = process.env.PORT || 8080
        app.listen(port, () =>
            console.log(
                `🌎 Server ready at http://localhost:${port}${server.graphqlPath}`
            )
        )
    } catch (e) {
        console.error(e)
        process.exit(-1)
    }
}
main()
