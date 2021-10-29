import { GraphQLResolveInfo } from 'graphql'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import { SubcategoryConnectionNode } from '../types/graphQL/subcategory'
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

const SUBCATEGORIES_CONNECTION_COLUMNS: string[] = ([
    'id',
    'name',
    'status',
    'system',
] as (keyof Subcategory)[]).map((field) => `Subcategory.${field}`)

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

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.innerJoin('Subcategory.organization', 'Organization')
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

    scope.select(SUBCATEGORIES_CONNECTION_COLUMNS)

    const data = await paginateData<Subcategory>({
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
                node: mapSubcategoryToSubcategoryConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

function mapSubcategoryToSubcategoryConnectionNode(
    subcategory: Subcategory
): SubcategoryConnectionNode {
    return {
        id: subcategory.id,
        name: subcategory.name || '',
        status: subcategory.status,
        system: !!subcategory.system,
    }
}
