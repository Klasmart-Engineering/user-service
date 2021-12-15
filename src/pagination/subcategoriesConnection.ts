import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import { SubcategoryConnectionNode } from '../types/graphQL/subcategory'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
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

export const subcategoriesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'id',
    aliases: {
        id: 'id',
        name: 'name',
    },
}

export async function subcategoriesConnectionResolver(
    info: GraphQLResolveInfo,
    ctx: Context,
    {
        direction,
        directionArgs,
        scope,
        filter,
        sort,
    }: IPaginationArgs<Subcategory>
): Promise<IPaginatedResponse<SubcategoryConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    scope = await subcategoryConnectionQuery(scope, filter)

    const data = await paginateData<Subcategory>({
        direction,
        directionArgs,
        scope,
        sort: {
            ...subcategoriesConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map(mapSubcategoryEdgeToSubcategoryConnectionEdge),
    }
}

function mapSubcategoryEdgeToSubcategoryConnectionEdge(
    edge: IEdge<Subcategory>
): IEdge<SubcategoryConnectionNode> {
    return {
        node: mapSubcategoryToSubcategoryConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export function mapSubcategoryToSubcategoryConnectionNode(
    subcategory: Subcategory
): SubcategoryConnectionNode {
    return {
        id: subcategory.id,
        name: subcategory.name || '',
        status: subcategory.status,
        system: subcategory.system,
    }
}

export const subcategoryConnectionNodeFields = ([
    'id',
    'name',
    'status',
    'system',
] as (keyof Subcategory)[]).map((field) => `Subcategory.${field}`)

export async function subcategoryConnectionQuery(
    scope: SelectQueryBuilder<Subcategory>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoin('Subcategory.organization', 'Organization')
        }

        if (filterHasProperty('categoryId', filter)) {
            scope.innerJoin('Subcategory.categories', 'Category')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                status: 'Subcategory.status',
                system: 'Subcategory.system',
                organizationId: 'Organization.organization_id',
                categoryId: 'Category.id',
            })
        )
    }

    scope.select(subcategoryConnectionNodeFields)

    return scope
}
