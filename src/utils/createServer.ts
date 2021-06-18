import { ApolloServer, makeExecutableSchema } from 'apollo-server-express'
import { Context } from '../main'
import { Model } from '../model'
import { checkToken } from '../token'
import { UserPermissions } from '../permissions/userPermissions'
import getSchema from '../schemas'
import { CustomError } from '../types/csv/csvError'

import { createDefaultDataLoaders } from '../loaders/setup'

export const createServer = (model: Model, context?: any) => {
    const schema = makeExecutableSchema(getSchema(model, context))
    return new ApolloServer({
        schema: schema,
        subscriptions: {
            keepAlive: 1000,
            onConnect: async (
                { authToken, sessionId, req }: any,
                websocket,
                connectionData: any
            ): Promise<Context> => {
                const token = await checkToken(authToken)
                const permissions = new UserPermissions(token)
                return {
                    sessionId,
                    token,
                    websocket,
                    permissions,
                    loaders: createDefaultDataLoaders(),
                }
            },
        },
        context:
            context ??
            (async ({ res, req, connection }) => {
                if (connection) {
                    return connection.context
                }
                const encodedToken =
                    req.headers.authorization || req.cookies.access
                const token = (await checkToken(encodedToken)) as any
                const permissions = new UserPermissions(token)

                return {
                    token,
                    permissions,
                    res,
                    req,
                    loaders: createDefaultDataLoaders(),
                }
            }),
        playground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        uploads: false,
        formatError: (error) => {
            if (error.originalError instanceof CustomError) {
                return { ...error, details: error.originalError.errors }
            }
            return {
                message: error.message,
                locations: error.locations,
                path: error.path,
                extensions: error.extensions,
            }
        },
    })
}
