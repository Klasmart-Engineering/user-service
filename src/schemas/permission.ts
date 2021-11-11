import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { permissionsConnectionResolver } from '../pagination/permissionsConnection'

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
        id: ID!
        name: String!
        category: String
        group: String
        level: String
        description: String
        allow: Boolean!
    }

    enum PermissionSortBy {
        id
        name
        category
        group
        level
    }

    input PermissionSortInput {
        field: PermissionSortBy!
        order: SortOrder!
    }

    input PermissionFilter {
        roleId: UUIDFilter
        name: StringFilter
        allow: BooleanFilter

        AND: [PermissionFilter!]
        OR: [PermissionFilter!]
    }

    extend type Query {
        permissionsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            sort: PermissionSortInput
            filter: PermissionFilter
        ): PermissionsConnectionResponse @isAdmin(entity: "permission")
        permissionNode(id: ID!): PermissionsConnectionNode
            @isAdmin(entity: "permission")
    }
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Query: {
                permissionsConnection: (_parent, args, ctx, info) =>
                    permissionsConnectionResolver(info, ctx, args),
                permissionNode: (_parent, args, ctx: Context) =>
                    ctx.loaders.permissionNode.node.instance.load(args),
            },
        },
    }
}
