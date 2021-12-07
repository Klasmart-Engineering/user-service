import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'
import { Class } from '../entities/class'
import { School } from '../entities/school'
import { ClassConnectionNode } from '../types/graphQL/class'
import { ClassSummaryNode } from '../types/graphQL/classSummaryNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    AVOID_NONE_SPECIFIED_BRACKETS,
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

/**
 * Core fields on `ClassConnectionNode` not populated by a DataLoader
 */
export type CoreClassConnectionNode = Pick<
    ClassConnectionNode,
    'id' | 'name' | 'status' | 'shortCode'
>

export const classesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'class_id',
    aliases: {
        id: 'class_id',
        name: 'class_name',
        shortCode: 'shortcode',
    },
}

export async function classesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Class>
): Promise<IPaginatedResponse<ClassSummaryNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    const newScope = await classesConnectionQuery(scope, filter)

    const data = await paginateData<Class>({
        direction,
        directionArgs,
        scope: newScope,
        sort: {
            ...classesConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: await Promise.all(
            data.edges.map(mapClassEdgeToClassConnectionEdge)
        ),
    }
}

export async function classesConnectionQuery(
    scope: SelectQueryBuilder<Class>,
    filter?: IEntityFilter
) {
    // Select only the ClassConnectionNode fields
    scope.select(coreClassConnectionNodeFields)

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

        if (filterHasProperty('studentId', filter)) {
            scope.innerJoin('Class.students', 'Student')
        }
        if (filterHasProperty('teacherId', filter)) {
            scope.innerJoin('Class.teachers', 'Teacher')
        }

        scope.andWhere(
            getWhereClauseFromFilter(scope, filter, {
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
                studentId: 'Student.user_id',
                teacherId: 'Teacher.user_id',
            })
        )
    }

    return scope
}

export function mapClassToClassConnectionNode(
    class_: Class
): CoreClassConnectionNode {
    return {
        id: class_.class_id,
        name: class_.class_name,
        status: class_.status,
        shortCode: class_.shortcode,
    }
}

async function mapClassEdgeToClassConnectionEdge(
    edge: IEdge<Class>
): Promise<IEdge<CoreClassConnectionNode>> {
    return {
        node: await mapClassToClassConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export const coreClassConnectionNodeFields = ([
    'class_id',
    'class_name',
    'status',
    'shortcode',
] as (keyof Class)[]).map((field) => `Class.${field}`)
