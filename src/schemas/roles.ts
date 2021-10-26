import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'

const typeDefs = gql`
    extend type Mutation {
        role(role_id: ID!): Role
        roles: [Role]
        uploadRolesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        replaceRole(
            old_role_id: ID!
            new_role_id: ID!
            organization_id: ID!
        ): Role
    }

    # pagination extension types start here
    type RolesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [RolesConnectionEdge]
    }

    type RolesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: RoleConnectionNode
    }

    # pagination extension types end here

    enum RoleSortBy {
        id
        name
    }

    input RoleSortInput {
        field: RoleSortBy!
        order: SortOrder!
    }

    input RoleFilter {
        # table columns
        name: StringFilter
        status: StringFilter
        system: BooleanFilter
        organizationId: UUIDFilter

        #joined columns
        AND: [RoleFilter]
        OR: [RoleFilter]
    }

    type RoleConnectionNode {
        id: ID!
        name: String
        description: String!
        status: Status!
        system: Boolean!
    }

    extend type Query {
        role(role_id: ID!): Role
        roles: [Role]
        rolesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: RoleFilter
            sort: RoleSortInput
        ): RolesConnectionResponse @isAdmin(entity: "role")
    }
    type Role {
        role_id: ID!

        #properties
        role_name: String
        role_description: String!
        status: Status!
        system_role: Boolean!

        #connections
        organization: Organization
        memberships: [OrganizationMembership]
        permissions: [Permission]
        permission(permission_name: String!): Permission

        #mutations
        set(
            role_name: String
            role_description: String
            system_role: Boolean
        ): Role
        grant(permission_name: String!): Permission
        revoke(permission_name: String!): Boolean
        edit_permissions(permission_names: [String!]): [Permission]
        deny(permission_name: String!): Permission @isAdmin

        delete_role(_: Int): Boolean
    }
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Mutation: {
                roles: (_parent, _args, ctx) => model.getRoles(ctx),
                role: (_parent, args, ctx, _info) => model.getRole(args, ctx),
                uploadRolesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadRolesFromCSV(args, ctx, info),
                replaceRole: (_parent, args, ctx, info) =>
                    model.replaceRole(args, ctx, info),
            },
            Query: {
                roles: (_parent, _args, ctx) => model.getRoles(ctx),
                role: (_parent, args, ctx, _info) => model.getRole(args, ctx),
                rolesConnection: (_parent, args, ctx: Context, info) => {
                    return model.rolesConnection(ctx, info, args)
                },
            },
        },
    }
}
