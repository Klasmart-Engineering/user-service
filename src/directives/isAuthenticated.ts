import { SchemaDirectiveVisitor } from 'apollo-server-express'
import { defaultFieldResolver, GraphQLField, GraphQLResolveInfo } from 'graphql'
import { Context } from '../main'

export class IsAuthenticatedDirective extends SchemaDirectiveVisitor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public visitFieldDefinition(field: GraphQLField<any, any>) {
        const { resolve = defaultFieldResolver } = field

        field.resolve = (
            prnt: unknown,
            args: Record<string, unknown>,
            context: Context,
            info: GraphQLResolveInfo
        ) => {
            context.permissions.rejectIfNotAuthenticated()

            return resolve.apply(this, [prnt, args, context, info])
        }
    }
}
