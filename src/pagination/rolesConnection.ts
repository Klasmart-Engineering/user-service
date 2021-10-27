import { GraphQLResolveInfo } from 'graphql'
import { Role } from '../entities/role'
import { RoleConnectionNode } from '../types/graphQL/roleConnectionNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { getWhereClauseFromFilter } from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

export async function rolesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Role>
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                name: 'Role.role_name',
                system: 'Role.system_role',
                status: 'Role.status',
                organizationId: 'Role.organizationOrganizationId',
            })
        )
    }

    scope.select(roleConnectionNodeFields)

    const data = await paginateData<Role>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'role_id',
            aliases: {
                id: 'role_id',
                name: 'role_name',
            },
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
