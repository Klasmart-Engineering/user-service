import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    type Permission {
        permission_id: ID
        permission_name: ID!
        permission_category: String
        permission_group: String
        permission_level: String
        permission_description: String
        allow: Boolean
    }

    type PermissionsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [PermissionsConnectionEdge]
    }

    type PermissionsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: PermissionsConnectionNode
    }

    type PermissionsConnectionNode {
        permission_id: ID
        permission_name: ID!
        permission_category: String
        permission_group: String
        permission_level: String
        permission_description: String
        allow: Boolean
    }

    input PermissionFilter {
        permission_id: StringFilter
        permission_name: StringFilter
        permission_category: StringFilter
        permission_group: StringFilter
        permission_level: StringFilter
        permission_description: StringFilter
        allow: BooleanFilter
        
        AND: [PermissionFilter!]
        OR: [PermissionFilter!]
    }

    extend type Query {
        permissionsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: PermissionFilter
        ): PermissionsConnectionResponse @isAuthenticated
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
                permissionsConnection: (_parent, args, ctx, _info) =>
                    model.permissionsConnection(ctx, args),
            },
        },
    }
}
