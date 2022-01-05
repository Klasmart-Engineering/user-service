import { GraphQLResolveInfo } from 'graphql'
import { Brackets, SelectQueryBuilder } from 'typeorm'
import { User } from '../entities/user'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'

import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

import {
    CoreUserConnectionNode,
    coreUserConnectionNodeFields,
    mapUserToUserConnectionNode,
    userConnectionSortingConfig,
} from './usersConnection'

export interface EligibleMembersPaginationArgs extends IPaginationArgs<User> {
    classId: string
}

export async function eligibleMembersConnectionResolver(
    info: GraphQLResolveInfo,
    permissionId: string,
    {
        // classId is explicitly passed, as it is a mandatory parameter not an optional filter value
        classId,
        direction,
        directionArgs,
        scope,
        filter,
        sort,
    }: EligibleMembersPaginationArgs
): Promise<IPaginatedResponse<CoreUserConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    const newScope = await eligibleMemberConnectionQuery(
        scope,
        classId,
        permissionId,
        filter
    )

    const data = await paginateData<User>({
        direction,
        directionArgs,
        scope: newScope,
        sort: {
            ...userConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map((edge) => {
            return {
                node: mapUserToUserConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

function membersWithPermission(
    permissionId: string,
    classId: string,
    scope: SelectQueryBuilder<User>
): SelectQueryBuilder<User> {
    return scope
        .innerJoin('User.memberships', 'OrganizationMembership')
        .innerJoin('OrganizationMembership.organization', 'Organization')
        .leftJoin('OrganizationMembership.roles', 'Role')
        .leftJoin('Role.permissions', 'Permission')
        .innerJoin('Organization.classes', 'Class')
        .leftJoin('User.school_memberships', 'SchoolMembership')
        .leftJoin('SchoolMembership.roles', 'SchoolRole')
        .leftJoin('SchoolRole.permissions', 'SchoolPermission')
        .leftJoin('Class.schools', 'School')
        .andWhere('Class.class_id = :class_id', { class_id: classId })
        .andWhere(
            new Brackets((qb) => {
                qb.where('Permission.permission_id = :permission_id', {
                    permission_id: permissionId,
                }).orWhere('SchoolPermission.permission_id = :permission_id')
            })
        )
        .groupBy(
            'User.user_id, OrganizationMembership.organization_id, Permission.permission_name, SchoolPermission.permission_name'
        )
        .having('bool_and(Permission.allow) = :allowed', { allowed: true })
        .orHaving('bool_and(SchoolPermission.allow) = :allowed', {
            allowed: true,
        })
}

export async function eligibleMemberConnectionQuery(
    scope: SelectQueryBuilder<User>,
    classId: string,
    permissionId: string,
    filter?: IEntityFilter
) {
    scope = membersWithPermission(permissionId, classId, scope)
    scope = scopeToClasses(scope)
    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                givenName: 'User.given_name',
                familyName: 'User.family_name',
                phone: 'User.phone',
                email: 'User.email',
            })
        )
    }
    scope.select(coreUserConnectionNodeFields)

    return scope
}

function scopeToClasses(
    scope: SelectQueryBuilder<User>
): SelectQueryBuilder<User> {
    scope.andWhere(
        new Brackets((qb) => {
            qb.where('School.school_name IS NULL')
                .orWhere('SchoolMembership.user_id IS NULL')
                .orWhere(
                    'SchoolMembership.schoolSchoolId = "School"."school_id"'
                )
        })
    )

    return scope
}
