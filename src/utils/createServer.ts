import { ApolloServer } from 'apollo-server-express'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { Context } from '../main'
import { Model } from '../model'
import { checkToken } from '../token'
import { UserPermissions } from '../permissions/userPermissions'
import getSchema from '../schemas'
import { CustomError } from '../types/csv/csvError'
import { createContextLazyLoaders } from '../loaders/setup'
import {
    isAdminTransformer,
    isAuthenticatedTransformer,
    isMIMETypeTransformer,
} from '../directives'
import { loadPlugins } from './plugins'
import { Request, Response } from 'express'

async function createContext({
    res,
    req,
}: {
    res: Response
    req: Request
}): Promise<Context> {
    const token = await checkToken(req)
    const permissions = new UserPermissions(token)

    return {
        token,
        permissions,
        res,
        req,
        logger: req.logger,
        loaders: createContextLazyLoaders(),
    }
}

export const createServer = async (model: Model) => {
    const environment = process.env.NODE_ENV
    const schema = [
        isAdminTransformer,
        isAuthenticatedTransformer,
        isMIMETypeTransformer,
    ].reduce(
        (previousSchema, transformer) => transformer(previousSchema),
        makeExecutableSchema(getSchema(model))
    )

    return new ApolloServer({
        schema: schema,
        context: createContext,

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
        // Defaults to `false` if `NODE_ENV === 'production'`, which removes the Schema & Docs from GraphQL Playground
        introspection: true,
        debug: environment === 'development',
    })
}
