import { GraphQLResolveInfo } from 'graphql'
import { Permission } from '../entities/permission'
import { Context } from '../main'
import { PermissionConnectionNode } from '../types/graphQL/permissionConnectionNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

export const PERMISSIONS_CONNECTION_COLUMNS: string[] = ([
    'permission_id',
    'permission_name',
    'permission_category',
    'permission_group',
    'permission_level',
    'permission_description',
    'allow',
] as (keyof Permission)[]).map((field) => `Permission.${field}`)

export async function permissionsConnectionResolver(
    info: GraphQLResolveInfo,
    ctx: Context,
    {
        direction,
        directionArgs,
        scope,
        filter,
        sort,
    }: IPaginationArgs<Permission>
): Promise<IPaginatedResponse<PermissionConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    if (filter) {
        // A non admin user has roles table joined since @isAdmin directive
        if (filterHasProperty('roleId', filter) && ctx.permissions.isAdmin) {
            scope.innerJoin('Permission.roles', 'Role')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                name: 'Permission.permission_name',
                allow: 'Permission.allow',
                role: 'Role.role_id',
            })
        )
    }

    scope.select(PERMISSIONS_CONNECTION_COLUMNS)

    const data = await paginateData<Permission>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'permission_name',
            aliases: {
                id: 'permission_id',
                name: 'permission_name',
                category: 'permission_category',
                group: 'permission_group',
                level: 'permission_level',
            },
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map((edge) => {
            return {
                node: mapPermissionToPermissionConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

function mapPermissionToPermissionConnectionNode(
    permission: Permission
): PermissionConnectionNode {
    return {
        id: permission.permission_id || '',
        name: permission.permission_name,
        category: permission.permission_category,
        group: permission.permission_group,
        level: permission.permission_level,
        description: permission.permission_description,
        allow: permission.allow,
    }
}
