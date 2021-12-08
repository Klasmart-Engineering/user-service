import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { AgeRange } from '../entities/ageRange'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRange'
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

export const ageRangesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'id',
    aliases: {
        id: 'id',
        lowValue: 'low_value',
        lowValueUnit: 'low_value_unit',
    },
}

export async function ageRangesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<AgeRange>
): Promise<IPaginatedResponse<AgeRangeConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    scope = await ageRangeConnectionQuery(scope, filter)

    const data = await paginateData<AgeRange>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'id',
            aliases: {
                id: 'id',
                lowValue: 'low_value',
                lowValueUnit: 'low_value_unit',
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
                node: mapAgeRangeToAgeRangeConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export async function ageRangeConnectionQuery(
    scope: SelectQueryBuilder<AgeRange>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('AgeRange.organization', 'Organization')
        }
        if (filterHasProperty('classId', filter)) {
            scope.innerJoin('AgeRange.classes', 'Class')
        }
        if (filterHasProperty('programId', filter)) {
            scope.innerJoin('AgeRange.programs', 'Program')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                ageRangeValueFrom: 'AgeRange.low_value',
                ageRangeUnitFrom: 'AgeRange.low_value_unit',
                ageRangeValueTo: 'AgeRange.high_value',
                ageRangeUnitTo: 'AgeRange.high_value_unit',
                system: 'AgeRange.system',
                status: 'AgeRange.status',
                organizationId: 'Organization.organization_id',
                classId: 'Class.class_id',
                programId: 'Program.id',
            })
        )
    }

    return scope.select(ageRangeNodeFields)
}

export function mapAgeRangeToAgeRangeConnectionNode(
    ageRange: AgeRange
): AgeRangeConnectionNode {
    return {
        id: ageRange.id,
        name: ageRange.name,
        status: ageRange.status,
        system: ageRange.system,
        lowValue: ageRange.low_value,
        lowValueUnit: ageRange.low_value_unit,
        highValue: ageRange.high_value,
        highValueUnit: ageRange.high_value_unit,
    }
}

export const ageRangeNodeFields = ([
    'id',
    'name',
    'status',
    'system',
    'low_value',
    'low_value_unit',
    'high_value',
    'high_value_unit',
] as (keyof AgeRange)[]).map((field) => `AgeRange.${field}`)
