import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { School } from '../entities/school'
import { ISchoolsConnectionNode } from '../types/graphQL/school'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
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
        edges: data.edges.map(mapSchoolEdgeToSchoolConnectionEdge),
    }
}

export async function schoolConnectionQuery(
    scope: SelectQueryBuilder<School>,
    filter?: IEntityFilter
) {
    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'School.organizationOrganizationId',
                // Could also refer to SchoolMembership.school_id
                schoolId: 'School.school_id',
                name: 'school_name',
                // Could also refer to OrganizationMembership.shortcode
                shortCode: 'School.shortcode',
                // Could also refer to [Organization/School]Membership.status
                status: 'School.status',
            })
        )
    }

    scope.select(schoolConnectionNodeFields)

    return scope
}

function mapSchoolEdgeToSchoolConnectionEdge(
    edge: IEdge<School>
): IEdge<ISchoolsConnectionNode> {
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
        organizationId: school.organizationOrganizationId,
    }
}

export const schoolConnectionNodeFields = ([
    'school_id',
    'school_name',
    'shortcode',
    'status',
    'organizationOrganizationId',
] as (keyof School)[]).map((field) => `School.${field}`)
