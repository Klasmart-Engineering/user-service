import { initApp } from './app'
import * as Sentry from '@sentry/node'
import WebSocket from 'ws'
import * as dotenv from 'dotenv'
import { UserPermissions } from './permissions/userPermissions'
import { IUsersConnectionLoaders } from './loaders/usersConnection'

dotenv.config({ path: __dirname + '/../.env' })
const port = process.env.PORT || 8080

export interface Context {
    token?: any
    sessionId?: string
    res?: any
    req?: any
    websocket?: WebSocket
    permissions: UserPermissions
    loaders: {
        usersConnection?: IUsersConnectionLoaders
    }
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
            console.log(
                `🌎 Server ready at http://localhost:${port}${app.apolloServer.graphqlPath}`
            )
        })
    })
    .catch((e) => {
        Sentry.captureException(e)
        console.error(e)
        process.exit(-1)
    })
