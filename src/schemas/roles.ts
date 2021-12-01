import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { GraphQLResolveInfo } from 'graphql'
import { RoleConnectionNode } from '../types/graphQL/role'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { IDataLoaders } from '../loaders/setup'

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
        schoolId: UUIDFilter
        schoolUserId: UUIDFilter
        membershipOrganizationUserId: UUIDFilter
        membershipOrganizationId: UUIDFilter

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
        permissionsConnection(
            direction: ConnectionDirection!
            count: PageSize
            cursor: String
            sort: PermissionSortInput
            filter: PermissionFilter
        ): PermissionsConnectionResponse
    }

    extend type Query {
        role(role_id: ID!): Role
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        roles: [Role]
        rolesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: RoleFilter
            sort: RoleSortInput
        ): RolesConnectionResponse @isAdmin(entity: "role")
        roleNode(id: ID!): RoleConnectionNode @isAdmin(entity: "role")
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
            @deprecated(
                reason: "Sunset Date: 26/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
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

export async function permissionsChildConnectionResolver(
    role: Pick<RoleConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return permissionsChildConnection(
        role,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

export async function permissionsChildConnection(
    role: Pick<RoleConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.permissionsConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: role.id,
            filterKey: 'roleId',
            pivot: '"Role"."role_id"',
        },
        primaryColumn: 'permission_name',
    })
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            RoleConnectionNode: {
                permissionsConnection: permissionsChildConnectionResolver,
            },
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
                roleNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.roleNode.node.instance.load(args)
                },
            },
        },
    }
}
