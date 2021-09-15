import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { UserConnectionNode } from '../types/graphQL/userConnectionNode'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
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
>

export async function usersConnectionResolver({
    direction,
    directionArgs,
    scope,
    filter,
    sort,
}: IPaginationArgs<User>): Promise<IPaginatedResponse<CoreUserConnectionNode>> {
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
            scope.innerJoin('User.school_memberships', 'SchoolMembership')
        }
        if (filterHasProperty('classId', filter)) {
            scope.leftJoin('User.classesStudying', 'ClassStudying')
            scope.leftJoin('User.classesTeaching', 'ClassTeaching')
        }
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'OrganizationMembership.organization_id',
                organizationUserStatus: 'OrganizationMembership.status',
                userId: 'User.user_id',
                phone: 'User.phone',
                schoolId: 'SchoolMembership.school_id',
                classId: {
                    operator: 'OR',
                    aliases: [
                        'ClassStudying.class_id',
                        'ClassTeaching.class_id',
                    ],
                },
            })
        )
    }

    scope.select(
        ([
            'user_id',
            'given_name',
            'family_name',
            'avatar',
            'status',
            'email',
            'phone',
            'alternate_email',
            'alternate_phone',
        ] as (keyof User)[]).map((field) => `User.${field}`)
    )

    const data = await paginateData<User>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'user_id',
            aliases: {
                givenName: 'given_name',
                familyName: 'family_name',
            },
            sort,
        },
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

export function mapUserToUserConnectionNode(
    user: User
): CoreUserConnectionNode {
    return {
        id: user.user_id,
        givenName: user.given_name,
        familyName: user.family_name,
        avatar: user.avatar,
        status: user.status,
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
