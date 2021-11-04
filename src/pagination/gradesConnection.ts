import { GraphQLResolveInfo } from 'graphql'
import { Grade } from '../entities/grade'
import { GradeSummaryNode } from '../types/graphQL/grade'
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

export async function gradesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Grade>
): Promise<IPaginatedResponse<GradeSummaryNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('Grade.organization', 'Organization')
        }

        if (filterHasProperty('fromGradeId', filter)) {
            scope.leftJoinAndSelect('Grade.progress_from_grade', 'FromGrade')
        }

        if (filterHasProperty('toGradeId', filter)) {
            scope.leftJoinAndSelect('Grade.progress_to_grade', 'ToGrade')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Grade.id',
                name: 'Grade.name',
                system: 'Grade.system',
                status: 'Grade.status',
                organizationId: 'Organization.organization_id',
                fromGradeId: 'FromGrade.id',
                toGradeId: 'ToGrade.id',
            })
        )
    }

    scope.select(gradeSummaryNodeFields)

    const data = await paginateData<Grade>({
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
                node: mapGradeToGradeConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export function mapGradeToGradeConnectionNode(grade: Grade): GradeSummaryNode {
    return {
        id: grade.id,
        name: grade.name,
        status: grade.status,
        system: !!grade.system,
        // other properties have dedicated resolvers that use Dataloader
    }
}

export const gradeSummaryNodeFields = ([
    'id',
    'name',
    'status',
    'system',
] as (keyof Grade)[]).map((field) => `Grade.${field}`)
