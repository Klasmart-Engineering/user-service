import { defaultFieldResolver, GraphQLField, GraphQLResolveInfo } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { Context } from '../main'

export class IsMIMETypeDirective extends SchemaDirectiveVisitor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public visitFieldDefinition(field: GraphQLField<any, any>) {
        const { resolve = defaultFieldResolver } = field
        const { mimetype } = this.args

        field.resolve = async (
            prnt: unknown,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args: Record<string, any>,
            context: Context,
            info: GraphQLResolveInfo
        ) => {
            const file = await args.file.promise

            if (file.mimetype !== mimetype) {
                return null
            }

            return resolve.apply(this, [prnt, args, context, info])
        }
    }
}
