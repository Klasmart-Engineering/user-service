import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'
import { defaultFieldResolver, GraphQLSchema } from 'graphql'
import { Context } from '../main'

export function isAuthenticatedTransformer(schema: GraphQLSchema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const isAuthenticatedDirective = getDirective(
                schema,
                fieldConfig,
                'isAuthenticated'
            )?.[0]
            if (!isAuthenticatedDirective) return

            const { resolve = defaultFieldResolver } = fieldConfig
            fieldConfig.resolve = async (
                source,
                args,
                context: Context,
                info
            ) => {
                context.permissions.rejectIfNotAuthenticated()
                return resolve(source, args, context, info)
            }
            return fieldConfig
        },
    })
}
