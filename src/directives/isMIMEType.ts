import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'
import { defaultFieldResolver, GraphQLSchema } from 'graphql'
import { Context } from '../main'

interface IsMIMETypeDirectiveArgs {
    mimetype: string
}

export function isMIMETypeTransformer(schema: GraphQLSchema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const isMIMETypeDirective = getDirective(
                schema,
                fieldConfig,
                'isMIMEType'
            )?.[0]
            if (!isMIMETypeDirective) return

            const { resolve = defaultFieldResolver } = fieldConfig
            const { mimetype } = isMIMETypeDirective as IsMIMETypeDirectiveArgs
            fieldConfig.resolve = async (
                source,
                args,
                context: Context,
                info
            ) => {
                const file = await args.file.promise

                if (file.mimetype !== mimetype) {
                    return null
                }

                return resolve(source, args, context, info)
            }
            return fieldConfig
        },
    })
}
