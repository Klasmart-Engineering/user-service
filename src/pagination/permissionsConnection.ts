import { GraphQLResolveInfo } from 'graphql'
import { Brackets, SelectQueryBuilder } from 'typeorm'
import { Permission } from '../entities/permission'
import { User } from '../entities/user'
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

const PERMISSIONS_CONNECTION_COLUMNS: string[] = ([
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

        if (filterHasProperty('organizationId', filter)) {
            // A non admin user has membership tables joined since @isAdmin directive
            if (ctx.permissions.isAdmin) {
                const userId = ctx.permissions.getUserId() || ''
                joinMemberships(scope, userId)
            }
        }

        const organizationAliases = scope.expressionMap.aliases
            // Getting alias names from the joined tables
            .map((a) => a.name)
            // Filtering those ones related to memberships
            .filter((a) => ['OrgMembership', 'SchoolMembership'].includes(a))
            // Adding 'organization_id' to each one
            .map((a) => `${a}.organization_id`)

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                name: 'Permission.permission_name',
                allow: 'Permission.allow',
                role: 'Role.role_id',
                organizationId:
                    organizationAliases.length === 1
                        ? organizationAliases[0]
                        : {
                              operator: 'OR',
                              aliases: organizationAliases,
                          },
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

async function joinMemberships(
    scope: SelectQueryBuilder<Permission>,
    userId: string
) {
    const user = await User.findOneOrFail(userId)
    const orgMemberships = await user.memberships
    const schoolMemberships = await user.school_memberships
    const rolesJoined = scope.expressionMap.aliases.find(
        (a) => a.name === 'Role'
    )

    if (!rolesJoined) {
        scope.innerJoin('Permission.roles', 'Role')
    }

    if (orgMemberships?.length && schoolMemberships?.length) {
        joinOrganizationAndSchoolMemberships(scope, userId)
        return
    }

    if (orgMemberships?.length) {
        joinOrganizationMemberships(scope, userId)
        return
    }

    if (schoolMemberships?.length) {
        joinSchoolMemberships(scope, userId)
        return
    }
}

export function joinOrganizationAndSchoolMemberships(
    scope: SelectQueryBuilder<Permission>,
    userId: string
) {
    scope
        .leftJoin('Role.memberships', 'OrgMembership')
        .leftJoin('Role.schoolMemberships', 'SchoolMembership')
        .where(
            new Brackets((qb) => {
                qb.where('OrgMembership.user_id = :userId', {
                    userId,
                }).orWhere('SchoolMembership.user_id = :userId', {
                    userId,
                })
            })
        )
}

export function joinOrganizationMemberships(
    scope: SelectQueryBuilder<Permission>,
    userId: string
) {
    scope
        .leftJoin('Role.memberships', 'OrgMembership')
        .where('OrgMembership.user_id = :userId', {
            userId,
        })
}

export function joinSchoolMemberships(
    scope: SelectQueryBuilder<Permission>,
    userId: string
) {
    scope
        .leftJoin('Role.schoolMemberships', 'SchoolMembership')
        .where('SchoolMembership.user_id = :userId', {
            userId,
        })
}
