import gql from 'graphql-tag'
import { GraphQLResolveInfo } from 'graphql'
import { Model } from '../model'
import { Context } from '../main'
import { permissionsConnectionResolver } from '../pagination/permissionsConnection'
import { PermissionConnectionNode } from '../types/graphQL/permission'
import {
    IChildPaginationArgs,
    IPaginatedResponse,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'
import { IDataLoaders } from '../loaders/setup'
import { RoleConnectionNode } from '../types/graphQL/role'
import { GraphQLSchemaModule } from '../types/schemaModule'

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

        rolesConnection(
            count: PageSize
            cursor: String
            filter: RoleFilter
            sort: RoleSortInput
            direction: ConnectionDirection
        ): RolesConnectionResponse
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
export async function rolesConnectionChildResolver(
    permission: Pick<PermissionConnectionNode, 'name'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    const includeTotalCount = shouldIncludeTotalCount(info, args)
    return rolesConnectionChild(
        permission.name,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

export async function rolesConnectionChild(
    permissionName: PermissionConnectionNode['id'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    return loaders.rolesConnectionChild.instance.load({
        args,
        includeTotalCount,
        parent: {
            id: permissionName,
            filterKey: 'permissionName',
            // on the permission_name property of the permission entity we tell typeORM to map it to the permission_id SQL column
            // and so in most places we can reference permission_name and expect typeORM to replace it with permission_id
            // however the pivot string is used in the generated query without this replacement happening
            // so we must specificy permission_id ourselves
            // in production both have the same values but we prefere permision_id as it's the primary key
            pivot: '"Permission"."permission_id"',
        },
        primaryColumn: 'role_id',
    })
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            PermissionsConnectionNode: {
                rolesConnection: rolesConnectionChildResolver,
            },
            Query: {
                permissionsConnection: (_parent, args, ctx, info) =>
                    permissionsConnectionResolver(info, ctx, args),
                permissionNode: (_parent, args, ctx: Context) =>
                    ctx.loaders.permissionNode.node.instance.load(args),
            },
        },
    }
}
