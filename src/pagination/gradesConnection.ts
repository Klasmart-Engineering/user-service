import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Grade } from '../entities/grade'
import { GradeSummaryNode } from '../types/graphQL/grade'
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

export const gradesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'id',
    aliases: {
        id: 'id',
        name: 'name',
    },
}

export async function gradesConnectionQuery(
    scope: SelectQueryBuilder<Grade>,
    filter?: IEntityFilter
) {
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

        if (filterHasProperty('classId', filter)) {
            scope.leftJoinAndSelect('Grade.classes', 'Class')
        }

        if (filterHasProperty('programId', filter)) {
            scope.leftJoinAndSelect('Grade.programs', 'Program')
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
                classId: 'Class.class_id',
                programId: 'Program.id',
            })
        )
    }

    scope.select(gradeSummaryNodeFields)

    return scope
}

export async function gradesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Grade>
): Promise<IPaginatedResponse<GradeSummaryNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    await gradesConnectionQuery(scope, filter)

    const data = await paginateData<Grade>({
        direction,
        directionArgs,
        scope,
        sort: {
            ...gradesConnectionSortingConfig,
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
