import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { ISchoolsConnectionNode } from '../types/graphQL/school'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
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

export const schoolsConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'school_id',
    aliases: {
        id: 'school_id',
        name: 'school_name',
        shortCode: 'shortcode',
    },
}

export async function schoolsConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<School>
): Promise<IPaginatedResponse<ISchoolsConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    const newScope = await schoolConnectionQuery(scope, filter)

    const data = await paginateData<School>({
        direction,
        directionArgs,
        scope: newScope,
        sort: {
            ...schoolsConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: await Promise.all(
            data.edges.map(mapSchoolEdgeToSchoolConnectionEdge)
        ),
    }
}

export async function schoolConnectionQuery(
    scope: SelectQueryBuilder<School>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (
            filterHasProperty('userId', filter) &&
            !scopeHasJoin(scope, SchoolMembership)
        ) {
            scope.innerJoin(
                SchoolMembership,
                'SchoolMembership',
                'School.school_id = SchoolMembership.schoolSchoolId'
            )
        }

        if (filterHasProperty('classId', filter)) {
            scope.innerJoin('School.classes', 'Class')
        }

        if (filterHasProperty('programId', filter)) {
            scope.innerJoin('School.programs', 'Program')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'School.organization',
                // Could also refer to SchoolMembership.school_id
                schoolId: 'School.school_id',
                name: 'school_name',
                // Could also refer to OrganizationMembership.shortcode
                shortCode: 'School.shortcode',
                // Could also refer to [Organization/School]Membership.status
                status: 'School.status',

                // Connections
                userId: 'SchoolMembership.userUserId',
                classId: 'Class.class_id',
                programId: 'Program.id',
            })
        )
    }

    scope.select(schoolConnectionNodeFields)

    return scope
}

async function mapSchoolEdgeToSchoolConnectionEdge(
    edge: IEdge<School>
): Promise<IEdge<ISchoolsConnectionNode>> {
    return {
        node: mapSchoolToSchoolConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export function mapSchoolToSchoolConnectionNode(
    school: School
): ISchoolsConnectionNode {
    return {
        id: school.school_id,
        name: school.school_name,
        status: school.status,
        shortCode: school.shortcode,
        organizationId: school.organization_id || '',
    }
}

export const schoolConnectionNodeFields = [
    ...([
        'school_id',
        'school_name',
        'shortcode',
        'status',
    ] as (keyof School)[]).map((field) => `School.${field}`),
    'School.organizationOrganizationId AS "School_organizationOrganizationId"', // will appear as 'organization_id' in object
]
