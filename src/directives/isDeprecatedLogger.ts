import { defaultFieldResolver, GraphQLSchema } from 'graphql'
import { Context } from '../main'
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'
import { KLLogger, withLogger } from '@kl-engineering/kidsloop-nodejs-logger'

export const deprecatedLogger: KLLogger = withLogger('deprecated')

export function isDeprecatedLoggerTransformer(schema: GraphQLSchema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            if (!getDirective(schema, fieldConfig, 'deprecated')) return

            const { resolve = defaultFieldResolver } = fieldConfig
            fieldConfig.resolve = async (
                source,
                args,
                context: Context,
                info
            ) => {
                deprecatedLogger.log(
                    'warn',
                    JSON.stringify({
                        operationType: info.operation.operation ?? '',
                        operationName: info.operation.name?.value ?? '',
                        deprecatedField: info.fieldName,
                        originURL: context.req.headers.origin ?? '',
                    })
                )
                return resolve(source, args, context, info)
            }
            return fieldConfig
        },
    })
}
