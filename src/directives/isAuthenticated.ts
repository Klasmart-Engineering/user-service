import { SchemaDirectiveVisitor } from 'apollo-server-express'
import { defaultFieldResolver } from 'graphql'

export class IsAuthenticatedDirective extends SchemaDirectiveVisitor {
    public visitFieldDefinition(field: any) {
        const { resolve = defaultFieldResolver } = field

        field.resolve = (prnt: any, args: any, context: any, info: any) => {
            context.permissions.rejectIfNotAuthenticated()

            return resolve.apply(this, [prnt, args, context, info])
        }
    }
}
