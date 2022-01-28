import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { UserConnectionNode } from '../types/graphQL/user'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
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

/**
 * Core fields on `UserConnectionNode` not populated by a DataLoader
 */
export type CoreUserConnectionNode = Pick<
    UserConnectionNode,
    | 'id'
    | 'givenName'
    | 'familyName'
    | 'avatar'
    | 'status'
    | 'contactInfo'
    | 'alternateContactInfo'
    | 'dateOfBirth'
    | 'gender'
>

export const userConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'user_id',
    aliases: {
        givenName: 'given_name',
        familyName: 'family_name',
    },
}

export async function usersConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<User>
): Promise<IPaginatedResponse<CoreUserConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    const newScope = await usersConnectionQuery(scope, filter)

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

export async function usersConnectionQuery(
    scope: SelectQueryBuilder<User>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (
            (filterHasProperty('organizationId', filter) ||
                filterHasProperty('organizationUserStatus', filter) ||
                filterHasProperty('roleId', filter)) &&
            !scopeHasJoin(scope, OrganizationMembership)
        ) {
            scope.innerJoin('User.memberships', 'OrganizationMembership')
        }
        if (filterHasProperty('roleId', filter)) {
            scope.innerJoin(
                'OrganizationMembership.roles',
                'RoleMembershipsOrganizationMembership'
            )
        }
        if (
            filterHasProperty('schoolId', filter) &&
            !scopeHasJoin(scope, SchoolMembership)
        ) {
            scope.leftJoin('User.school_memberships', 'SchoolMembership')
        }

        if (filterHasProperty('classId', filter)) {
            scope.leftJoin('User.classesStudying', 'ClassStudying')
            scope.leftJoin('User.classesTeaching', 'ClassTeaching')
            if (
                filterHasProperty('classStudyingId', filter) ||
                filterHasProperty('classTeachingId', filter)
            ) {
                throw new Error(
                    'Cannot filter by classId in combination with classStudyingId/classTeachingId.'
                )
            }
        } else {
            if (filterHasProperty('classStudyingId', filter)) {
                scope.innerJoin('User.classesStudying', 'ClassStudying')
            }
            if (filterHasProperty('classTeachingId', filter)) {
                scope.innerJoin('User.classesTeaching', 'ClassTeaching')
            }
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'OrganizationMembership.organization_id',
                organizationUserStatus: 'OrganizationMembership.status',
                userStatus: 'User.status',
                userId: 'User.user_id',
                phone: 'User.phone',
                email: 'User.email',
                username: 'User.username',
                schoolId: 'SchoolMembership.school_id',
                classId: {
                    operator: 'OR',
                    aliases: [
                        'ClassStudying.class_id',
                        'ClassTeaching.class_id',
                    ],
                },
                classStudyingId: 'ClassStudying.class_id',
                classTeachingId: 'ClassTeaching.class_id',
            })
        )
    }

    scope.select(coreUserConnectionNodeFields)

    return scope
}

export function mapUserToUserConnectionNode(
    user: User
): CoreUserConnectionNode {
    return {
        id: user.user_id,
        givenName: user.given_name,
        familyName: user.family_name,
        avatar: user.avatar,
        status: user.status,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        contactInfo: {
            email: user.email,
            phone: user.phone,
        },
        alternateContactInfo: {
            email: user.alternate_email,
            phone: user.alternate_phone,
        },
        // other properties have dedicated resolvers that use Dataloader
    }
}

export function extractCoreUserConnectionNode(
    user: UserConnectionNode
): CoreUserConnectionNode {
    return {
        id: user.id,
        givenName: user.givenName,
        familyName: user.familyName,
        avatar: user.avatar,
        status: user.status,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        contactInfo: {
            email: user.contactInfo.email,
            phone: user.contactInfo.phone,
        },
        alternateContactInfo: {
            email: user.alternateContactInfo?.email,
            phone: user.alternateContactInfo?.phone,
        },
    }
}

export const coreUserConnectionNodeFields = ([
    'user_id',
    'given_name',
    'family_name',
    'avatar',
    'status',
    'email',
    'phone',
    'alternate_email',
    'alternate_phone',
    'date_of_birth',
    'gender',
    'username',
] as (keyof User)[]).map((field) => `User.${field}`)
