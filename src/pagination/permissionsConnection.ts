import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Permission } from '../entities/permission'
import { Role } from '../entities/role'
import { NodeDataLoader } from '../loaders/genericNode'
import { PermissionConnectionNode } from '../types/graphQL/permission'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { Lazy } from '../utils/lazyLoading'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'
import { scopeHasJoin } from '../utils/typeorm'

export const permissionConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'permission_name',
    aliases: {
        id: 'permission_id',
        name: 'permission_name',
        category: 'permission_category',
        group: 'permission_group',
        level: 'permission_level',
    },
}

export interface IPermissionNodeDataLoaders {
    node: Lazy<NodeDataLoader<Permission, PermissionConnectionNode>>
}

export const permissionSummaryNodeFields: string[] = ([
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
    {
        direction,
        directionArgs,
        scope,
        filter,
        sort,
    }: IPaginationArgs<Permission>
): Promise<IPaginatedResponse<PermissionConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    scope = await permissionConnectionQuery(scope, filter)

    const data = await paginateData<Permission>({
        direction,
        directionArgs,
        scope,
        sort: {
            ...permissionConnectionSortingConfig,
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

export async function permissionConnectionQuery(
    scope: SelectQueryBuilder<Permission>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('roleId', filter) && !scopeHasJoin(scope, Role)) {
            scope.innerJoin('Permission.roles', 'Role')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                name: 'Permission.permission_name',
                allow: 'Permission.allow',
                roleId: 'Role.role_id',
            })
        )
    }

    scope.select(permissionSummaryNodeFields)
    return scope
}

export function mapPermissionToPermissionConnectionNode(
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
