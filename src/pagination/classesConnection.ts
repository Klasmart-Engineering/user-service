import { GraphQLResolveInfo } from 'graphql'
import { School } from '../entities/school'
import { Class } from '../entities/class'
import { ClassConnectionNode } from '../types/graphQL/classConnectionNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    AVOID_NONE_SPECIFIED_BRACKETS,
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
import { scopeHasJoin } from '../utils/typeorm'
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'

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
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    const newScope = await classConnectionQuery(scope, filter)

    const data = await paginateData<Class>({
        direction,
        directionArgs,
        scope: newScope,
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
                node: mapClassToClassConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export async function classConnectionQuery(
    scope: SelectQueryBuilder<Class>,
    filter?: IEntityFilter
) {
    scope.select([
        'Class.class_id',
        'Class.class_name',
        'Class.status',
        'Class.shortcode',
    ])

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

    return scope
}

export function mapClassToClassConnectionNode(
    classObj: Class
): ClassConnectionNode {
    return {
        id: classObj.class_id,
        name: classObj.class_name,
        status: classObj.status,
        shortCode: classObj.shortcode,
        // TODO: wtf
        // schools: (await classObj.schools.map(()=> school.school_id)) || '',
    }
}
