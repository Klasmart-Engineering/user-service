import { Organization } from '../entities/organization'
import { School } from '../entities/school'
import { ISchoolsConnectionNode } from '../types/graphQL/schoolsConnectionNode'
import { getWhereClauseFromFilter } from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

export async function schoolsConnectionResolver({
    direction,
    directionArgs,
    scope,
    filter,
    sort,
}: IPaginationArgs<School>): Promise<
    IPaginatedResponse<ISchoolsConnectionNode>
> {
    // Required for building SchoolConnectionNode
    // TODO remove once School.organization_id FK is exposed on the Entity
    scope.innerJoin('School.organization', 'Organization')

    if (filter) {
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
            })
        )
    }

    const selects = ([
        'school_id',
        'school_name',
        'shortcode',
        'status',
    ] as (keyof School)[]).map((field) => `School.${field}`)

    selects.push(
        ...(['organization_id'] as (keyof Organization)[]).map(
            (field) => `Organization.${field}`
        )
    )

    scope.select(selects)

    const data = await paginateData<School>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'school_id',
            aliases: {
                id: 'school_id',
                name: 'school_name',
                shortCode: 'shortcode',
            },
            sort,
        },
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: await Promise.all(
            data.edges.map(mapSchoolEdgeToSchoolConnectionEdge)
        ),
    }
}

async function mapSchoolEdgeToSchoolConnectionEdge(
    edge: IEdge<School>
): Promise<IEdge<ISchoolsConnectionNode>> {
    return {
        node: await mapSchoolToSchoolConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export async function mapSchoolToSchoolConnectionNode(
    school: School
): Promise<ISchoolsConnectionNode> {
    return {
        id: school.school_id,
        name: school.school_name,
        status: school.status,
        shortCode: school.shortcode,
        organizationId: (await school.organization)?.organization_id || '',
    }
}
