import { GraphQLResolveInfo } from 'graphql'
import { School } from '../entities/school'
import { Class } from '../entities/class'
import { ClassConnectionNode } from '../types/graphQL/classConnectionNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    AVOID_NONE_SPECIFIED_BRACKETS,
    ConditionalJoinCmd,
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
import { SelectQueryBuilder } from 'typeorm'

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
): Promise<IPaginatedResponse<ClassConnectionNode>> {
    const data = await paginateData<ClassConnectionNode>({
        direction,
        directionArgs,
        scope: await classConnectionQuery(scope, filter),
        sort: { ...classesConnectionSortingConfig, sort: sort },
        includeTotalCount: findTotalCountInPaginationEndpoints(info),
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map((edge) => {
            return {
                node: mapClassToClassConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export async function classConnectionQuery(
    scope: SelectQueryBuilder<Class>,
    filter: IEntityFilter | undefined
) {
    scope?.select([
        'Class.class_id',
        'Class.class_name',
        'Class.status',
        'Class.shortcode',
    ])

    if (filter) {
        classConnectionFilter(scope, filter)
        classConnectionWhere(scope, filter)
    }

    return scope
}

function classConnectionFilter(
    scope: SelectQueryBuilder<Class>,
    filter: IEntityFilter
) {
    const ageRangeFilters = [
        'ageRangeValueFrom',
        'ageRangeUnitFrom',
        'ageRangeValueTo',
        'ageRangeUnitTo',
    ]

    new ConditionalJoinCmd<Class>(scope, filter)
        .joinIfFilter(
            ['schoolId'],
            () =>
                !scopeHasJoin(scope, School) &&
                scope.innerJoin('Class.schools', 'School')
        )
        .joinIfFilter(ageRangeFilters, () => {
            scope
                .innerJoin('Class.age_ranges', 'AgeRange')
                .where(AVOID_NONE_SPECIFIED_BRACKETS)
        })
        .joinIfFilter(['gradeId'], () =>
            scope.innerJoin('Class.grades', 'Grade')
        )
        .joinIfFilter(['subjectId'], () =>
            scope.innerJoin('Class.subjects', 'Subject')
        )
        .joinIfFilter(['programId'], () =>
            scope.innerJoin('Class.programs', 'Program')
        )
}

function classConnectionWhere(
    scope: SelectQueryBuilder<Class>,
    filter: IEntityFilter
) {
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

export function mapClassToClassConnectionNode(
    classObj: ClassConnectionNode
): ClassConnectionNode {
    return {
        id: classObj.id,
        name: classObj.name,
        status: classObj.status,
        shortCode: classObj.shortCode,
    }
}