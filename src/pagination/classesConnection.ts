import { GraphQLResolveInfo } from 'graphql'
import { School } from '../entities/school'
import { Class } from '../entities/class'
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
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'
import { ClassConnectionNode } from '../types/graphQL/class'
import { Organization } from '../entities/organization'

export const classesSummeryNodeFields = [
        'Class.class_id',
        'Class.class_name',
        'Class.status',
        'Class.shortcode',
    ]

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
    const data = await paginateData<Class>({
        direction,
        directionArgs,
        scope: await classesConnectionQuery(scope, filter),
        sort: {
            ...classesConnectionSortingConfig,
            sort,
        },
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

export async function classesConnectionQuery(
    scope: SelectQueryBuilder<Class>,
    filter?: IEntityFilter
) {
    classesConnectionSelect(scope)

    if (filter) {
        classesConnectionFilter(scope, filter)
        classesConnectionWhere(scope, filter)
    }

    return scope
}

function classesConnectionSelect(scope: SelectQueryBuilder<Class>) {
    scope.select(classesSummeryNodeFields)
}

function classesConnectionFilter(
    scope: SelectQueryBuilder<Class>,
    filter: IEntityFilter
) {
    const ageRangeFilters = [
        'ageRangeValueFrom',
        'ageRangeUnitFrom',
        'ageRangeValueTo',
        'ageRangeUnitTo',
    ]

    new ConditionalJoinCmd(filter)
        .ifFilter(
            'schoolId',
            () =>
                !scopeHasJoin(scope, School) &&
                    scope.innerJoin('Class.schools', 'School')
        )
        .ifFilter(ageRangeFilters, () => {
            scope
                .innerJoin('Class.age_ranges', 'AgeRange')
                .where(AVOID_NONE_SPECIFIED_BRACKETS)
        })
        .ifFilter('schoolId', () => {
            // nonAdminClassScope may have already joined on Schools
            !scopeHasJoin(scope, School) &&
                scope.leftJoin('Class.schools', 'School')
        })
        .ifFilter('organizationId', () => {
            // nonAdminClassScope may have already joined on Schools
            !scopeHasJoin(scope, Organization) &&
                scope.leftJoin('Class.organization', 'Organization')
        })
        .ifFilter('gradeId', () => scope.innerJoin('Class.grades', 'Grade'))
        .ifFilter('subjectId', () =>
            scope.innerJoin('Class.subjects', 'Subject')
        )
        .ifFilter('programId', () =>
            scope.innerJoin('Class.programs', 'Program')
        )
}

function classesConnectionWhere(
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

export function mapClassToClassConnectionNode(_class: Class): ClassConnectionNode {
    return {
        id: _class.class_id,
        name: _class.class_name,
        status: _class.status,
        shortCode: _class.shortcode,
    }
}