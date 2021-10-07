import { GraphQLResolveInfo } from 'graphql'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Program } from '../entities/program'

import { SchoolMembership } from '../entities/schoolMembership'

import { User } from '../entities/user'
import { ProgramConnectionNode } from '../types/graphQL/programConnectionNode'


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

import { scopeHasJoin } from '../utils/typeorm'

/**

 * Core fields on `UserConnectionNode` not populated by a DataLoader

 */

export type CoreProgramConnectionNode = Pick<
    ProgramConnectionNode,
    'id' | 'name' | 'status' | 'system'
>

export async function programsConnectionResolver(
    info: GraphQLResolveInfo,

    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Program>
): Promise<IPaginatedResponse<CoreProgramConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

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
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'OrganizationMembership.organization_id',

                organizationUserStatus: 'OrganizationMembership.status',

                userStatus: 'User.status',

                userId: 'User.user_id',

                phone: 'User.phone',

                email: 'User.email',

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
        (['id', 'name', 'status', 'system'] as (keyof Program)[]).map(
            (field) => `Program.${field}`
        )
    )

    scope.select(coreProgramConnectionNodeFields)

    const data = await paginateData<Program>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'id',
            aliases: {
                id: 'id',
                name: 'name',
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
                node: mapProgramToProgramConnectionNode(edge.node),

                cursor: edge.cursor,
            }
        }),
    }
}

export function mapProgramToProgramConnectionNode(
    program: Program
): CoreProgramConnectionNode {
    return {
        id: program.id,
        name: program.name,
        status: program.status,
        system: program.system ?? false,

        // other properties have dedicated resolvers that use Dataloader
    }
}

export const coreProgramConnectionNodeFields = ([
    'id',
    'name',
    'status',
    'system',
] as (keyof Program)[]).map((field) => `Program.${field}`)
