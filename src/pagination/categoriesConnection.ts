import { GraphQLResolveInfo } from 'graphql'
import { Category } from '../entities/category'
import { CategoryConnectionNode } from '../types/graphQL/category'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { getWhereClauseFromFilter } from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
export async function categoriesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Category>
): Promise<IPaginatedResponse<CategoryConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(scope, filter, {
                name: 'Category.name',
                system: 'Category.system',
                status: 'Category.status',
            })
        )
    }

    scope.select(categoryConnectionNodeFields)

    const data = await paginateData<Category>({
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
        edges: data.edges.map(mapCategoryEdgeToCategoryConnectionEdge),
    }
}

function mapCategoryEdgeToCategoryConnectionEdge(
    edge: IEdge<Category>
): IEdge<CategoryConnectionNode> {
    return {
        node: mapCategoryToCategoryConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export function mapCategoryToCategoryConnectionNode(
    category: Category
): CategoryConnectionNode {
    return {
        id: category.id,
        name: category.name,
        status: category.status,
        system: category.system,
    }
}

export const categoryConnectionNodeFields = ([
    'id',
    'name',
    'system',
    'status',
] as (keyof Category)[]).map((field) => `Category.${field}`)
