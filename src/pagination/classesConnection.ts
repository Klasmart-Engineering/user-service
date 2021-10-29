import { GraphQLResolveInfo } from 'graphql'
import { Class } from '../entities/class'
import { School } from '../entities/school'
import { ClassSummaryNode } from '../types/graphQL/classSummaryNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    AVOID_NONE_SPECIFIED_BRACKETS,
    filterHasProperty,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
import { scopeHasJoin } from '../utils/typeorm'

export async function classesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Class>
): Promise<IPaginatedResponse<ClassSummaryNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    // Select only the ClassConnectionNode fields
    scope.select(classSummaryNodeFields)

    if (filter) {
        if (
            filterHasProperty('ageRangeValueFrom', filter) ||
            filterHasProperty('ageRangeUnitFrom', filter) ||
            filterHasProperty('ageRangeValueTo', filter) ||
            filterHasProperty('ageRangeUnitTo', filter)
        ) {
            scope
                .innerJoin('Class.age_ranges', 'AgeRange')
                .where(AVOID_NONE_SPECIFIED_BRACKETS)
        }

        if (
            filterHasProperty('schoolId', filter) &&
            // nonAdminClassScope may have already joined on Schools
            !scopeHasJoin(scope, School)
        ) {
            scope.leftJoin('Class.schools', 'School')
        }

        if (filterHasProperty('gradeId', filter)) {
            scope.innerJoin('Class.grades', 'Grade')
        }

        if (filterHasProperty('subjectId', filter)) {
            scope.innerJoin('Class.subjects', 'Subject')
        }

        if (filterHasProperty('programId', filter)) {
            scope.innerJoin('Class.programs', 'Program')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Class.class_id',
                name: 'Class.class_name',
                status: 'Class.status',
                // No need to join, use the Foreign Key on the Class entity
                organizationId: 'Class.organization',
                ageRangeValueFrom: 'AgeRange.low_value',
                ageRangeUnitFrom: 'AgeRange.low_value_unit',
                ageRangeValueTo: 'AgeRange.high_value',
                ageRangeUnitTo: 'AgeRange.high_value_unit',
                schoolId: 'School.school_id',
                gradeId: 'Grade.id',
                subjectId: 'Subject.id',
                programId: 'Program.id',
            })
        )
    }

    const data = await paginateData<Class>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'class_id',
            aliases: {
                id: 'class_id',
                name: 'class_name',
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
                node: mapClassToClassNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export function mapClassToClassNode(class_: Class): ClassSummaryNode {
    return {
        id: class_.class_id,
        name: class_.class_name,
        status: class_.status,
        shortCode: class_.shortcode,
        // other properties have dedicated resolvers that use Dataloader
    }
}

export const classSummaryNodeFields = ([
    'class_id',
    'class_name',
    'status',
    'shortcode',
] as (keyof Class)[]).map((field) => `Class.${field}`)
