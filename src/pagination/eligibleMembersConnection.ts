import { GraphQLResolveInfo } from 'graphql'
import { Brackets, SelectQueryBuilder } from 'typeorm'
import { distinctMembers } from '../directives/isAdminUtils'
import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { PermissionName } from '../permissions/permissionNames'
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
import { scopeHasJoin } from '../utils/typeorm'

import {
    CoreUserConnectionNode,
    coreUserConnectionNodeFields,
    mapUserToUserConnectionNode,
    userConnectionSortingConfig,
} from './usersConnection'

export interface EligibleMembersPaginationArgs extends IPaginationArgs<User> {
    classId: string
}

type ClassMembershipPermission =
    | PermissionName.attend_live_class_as_a_teacher_186
    | PermissionName.attend_live_class_as_a_student_187

export async function eligibleMembersConnectionResolver(
    info: GraphQLResolveInfo,
    permissionId: ClassMembershipPermission,
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
    if (!scopeHasJoin(scope, OrganizationMembership)) {
        scope.innerJoin('User.memberships', 'OrganizationMembership')
    }
    if (!scopeHasJoin(scope, SchoolMembership)) {
        scope.leftJoin('User.school_memberships', 'SchoolMembership')
    }
    return scope
        .innerJoin('OrganizationMembership.organization', 'Organization')
        .leftJoin('OrganizationMembership.roles', 'Role')
        .leftJoin('Role.permissions', 'Permission')
        .innerJoin('Organization.classes', 'Class')
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
    permissionId: ClassMembershipPermission,
    filter?: IEntityFilter
) {
    scope = membersWithPermission(permissionId, classId, scope)
    scope = scopeToClasses(scope)

    if (permissionId === 'attend_live_class_as_a_teacher_186') {
        excludeMembers('teacher', scope, classId)
    } else {
        excludeMembers('student', scope, classId)
    }

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                givenName: 'User.given_name',
                familyName: 'User.family_name',
                phone: 'User.phone',
                email: 'User.email',
                username: 'User.username',
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

function excludeMembers(
    memberType: 'student' | 'teacher',
    scope: SelectQueryBuilder<User>,
    classId: string
) {
    const table =
        memberType === 'student'
            ? 'user_classes_studying_class'
            : 'user_classes_teaching_class'

    const query = distinctMembers(table, 'classClassId', [classId])!
    scope.setParameters({
        ...scope.getParameters(),
        ...query.getParameters(),
    })
    scope.andWhere(`"User"."user_id" NOT IN (${query!.getQuery()})`)
}
