import { ApolloServer } from 'apollo-server-express'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { Context } from '../main'
import { Model } from '../model'
import { checkToken } from '../token'
import { UserPermissions } from '../permissions/userPermissions'
import getSchema from '../schemas'
import { CustomError } from '../types/csv/csvError'
import { createDefaultDataLoaders } from '../loaders/setup'
import {
    isAdminTransformer,
    isAuthenticatedTransformer,
    isMIMETypeTransformer,
} from '../directives'
import { loadPlugins } from './plugins'

export const createServer = async (model: Model, context?: Context) => {
    const environment = process.env.NODE_ENV
    const schema = [
        isAdminTransformer,
        isAuthenticatedTransformer,
        isMIMETypeTransformer,
    ].reduce(
        (previousSchema, transformer) => transformer(previousSchema),
        makeExecutableSchema(getSchema(model, context))
    )

    return new ApolloServer({
        schema: schema,
        context:
            context ??
            (async ({ res, req }) => {
                const encodedToken =
                    req.headers.authorization || req.cookies.access
                const token = await checkToken(encodedToken)
                const permissions = new UserPermissions(token)

                return {
                    token,
                    permissions,
                    res,
                    req,
                    loaders: createDefaultDataLoaders(),
                }
            }),
        plugins: await loadPlugins(),
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
        debug: environment === 'development',
    })
}
