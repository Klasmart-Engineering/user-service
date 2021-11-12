import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Permission } from '../entities/permission'
import { Role } from '../entities/role'
import { NodeDataLoader } from '../loaders/genericNode'
import { RoleConnectionNode, RoleSummaryNode } from '../types/graphQL/role'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { Lazy } from '../utils/lazyLoading'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'
import { scopeHasJoin } from '../utils/typeorm'

export const rolesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'role_id',
    aliases: {
        id: 'role_id',
        name: 'role_name',
    },
}

export interface IRoleNodeDataLoaders {
    node: Lazy<NodeDataLoader<Role, RoleSummaryNode>>
}

export async function rolesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Role>
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    roleConnectionQuery(scope, filter)

    const data = await paginateData<Role>({
        direction,
        directionArgs,
        scope,
        sort: {
            ...rolesConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map(mapRoleEdgeToRoleConnectionEdge),
    }
}

export function roleConnectionQuery(
    scope: SelectQueryBuilder<Role>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (
            filterHasProperty('permissionName', filter) &&
            !scopeHasJoin(scope, Permission)
        ) {
            scope.innerJoin('Role.permissions', 'Permission')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                name: 'Role.role_name',
                system: 'Role.system_role',
                status: 'Role.status',
                organizationId: 'Role.organizationOrganizationId',
                permissionName: 'Permission.permission_name',
            })
        )
    }

    scope.select(roleConnectionNodeFields)

    return scope
}

function mapRoleEdgeToRoleConnectionEdge(
    edge: IEdge<Role>
): IEdge<RoleConnectionNode> {
    return {
        node: mapRoleToRoleConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export function mapRoleToRoleConnectionNode(role: Role): RoleConnectionNode {
    return {
        id: role.role_id,
        name: role.role_name,
        status: role.status,
        system: role.system_role,
        description: role.role_description,
    }
}

export const roleConnectionNodeFields = ([
    'role_id',
    'role_name',
    'system_role',
    'role_description',
    'status',
] as (keyof Role)[]).map((field) => `Role.${field}`)
