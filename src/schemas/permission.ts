import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Query {
        permissions(
            after: String
            before: String
            first: Int
            last: Int
        ): PermissionConnection! @isAuthenticated
    }
    type Permission {
        permission_id: ID
        permission_name: ID!
        permission_category: String
        permission_group: String
        permission_level: String
        permission_description: String
        allow: Boolean
    }
    type PermissionConnection {
        total: Int
        edges: [Permission]!
        pageInfo: PageInfo!
    }
`
export default function getDefault(
    model: Model,
    context: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Query: {
                permissions: (_parent, args, ctx, _info) =>
                    model.getPermissions(ctx, args),
            },
        },
    }
}
