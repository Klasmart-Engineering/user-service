import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class IsMIMETypeDirective extends SchemaDirectiveVisitor {
    public visitFieldDefinition(field: any) {
        const { resolve = defaultFieldResolver } = field
        const { mimetype } = this.args

        field.resolve = async (
            prnt: any,
            args: any,
            context: any,
            info: any
        ) => {
            const { file } = await args.file

            if (file.mimetype !== mimetype) {
                return null
            }

            return resolve.apply(this, [prnt, args, context, info])
        }
    }
}
