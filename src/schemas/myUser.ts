import { ApolloServerExpressConfig } from 'apollo-server-express'
import gql from 'graphql-tag'
import { Context } from '../main'
import { Model } from '../model'
import { mapUserToUserConnectionNode } from '../pagination/usersConnection'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

const typeDefs = gql`
    extend type Query {
        myUser: MyUser
    }

    type MyUser {
        node: UserConnectionNode
    }
`

export default function getDefault(model: Model): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            MyUser: {
                node: async (_parent, _args, ctx: Context, _info) => {
                    const user = await model.getMyUser(ctx)
                    if (!user) {
                        throw new APIErrorCollection([
                            new APIError({
                                code: customErrors.nonexistent_entity.code,
                                message:
                                    customErrors.nonexistent_entity.message,
                                variables: ['id'],
                                entity: 'User',
                                entityName: ctx.permissions.getUserId(),
                            }),
                        ])
                    }
                    return mapUserToUserConnectionNode(user)
                },
            },
            Query: {
                myUser: (_, _args, ctx, _info) => {
                    // all properties of MyUser have dedicated resolvers, so just return an empty object
                    return {}
                },
            },
        },
    }
}
