import { Request, Response } from 'express'
import depthLimit from 'graphql-depth-limit'
import { ApolloServer } from 'apollo-server-express'
import { Context } from '../main'
import { Model } from '../model'
import { resLocal } from '../token'
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

import newrelic from 'newrelic'
import { withCorrelation } from '@kl-engineering/kidsloop-nodejs-logger'

/* accessing a child via a connection field takes 3 depth
    myconnection { // 0
        edges{ // 1
            node{ // 2
                child // 3
            }
        }
    }
10 = 3 * 3 nested connections + 1 root level node
*/
// changing this? update the docs: constraints.md
export const DEFAULT_MAX_QUERY_DEPTH = 10

export function maxQueryDepth(): number {
    const envVarName = 'MAX_QUERY_DEPTH'
    const envVarValue = process.env[envVarName]
    if (typeof envVarValue === 'undefined') {
        return DEFAULT_MAX_QUERY_DEPTH
    } else {
        const maxQueryDepth = parseInt(envVarValue, 10)
        // we want to be able to reduce it in emergencies if a particular kind of request causes performance impact
        // or we get DOS'd
        // but we don't want it to be increased without discussion with our team
        if (isNaN(maxQueryDepth) || maxQueryDepth < 0) {
            throw Error(
                `${envVarName} environment variable must be a postive integer, was: ${envVarValue}`
            )
        } else if (maxQueryDepth > DEFAULT_MAX_QUERY_DEPTH) {
            throw Error(
                `${envVarName} environment variable must not be more than ${DEFAULT_MAX_QUERY_DEPTH}, was: ${envVarValue}`
            )
        }
        return maxQueryDepth
    }
}

async function createContext({
    res,
    req,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res: Response<any, resLocal>
    req: Request
}): Promise<Context> {
    const token = res.locals.token
    const apiKey = res.locals.hasApiKey

    const permissions = new UserPermissions(token, apiKey)

    const correlationId = withCorrelation()
    if (correlationId) {
        newrelic.addCustomAttribute('correlationId', correlationId)
    }

    const requestOrigin = req.headers.origin
    if (requestOrigin) {
        newrelic.addCustomAttribute('requestOrigin', requestOrigin)
    }

    return {
        token,
        permissions,
        res,
        req,
        loaders: createContextLazyLoaders(permissions),
    }
}

export const createServer = async (model: Model) => {
    const environment = process.env.NODE_ENV

    // 1. Generate GraphQL schema from modules
    let schema = getSchema(model)

    // 2. Transform the schema by applying directive logic
    schema = [
        isAdminTransformer,
        isAuthenticatedTransformer,
        isMIMETypeTransformer,
    ].reduce(
        (previousSchema, transformer) => transformer(previousSchema),
        schema
    )

    // 3. create Apollo Server
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
        validationRules: [depthLimit(maxQueryDepth())],
    })
}
