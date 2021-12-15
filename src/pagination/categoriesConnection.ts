import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Category } from '../entities/category'
import { CategoryConnectionNode } from '../types/graphQL/category'
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

export const categoriesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'id',
    aliases: {
        id: 'id',
        name: 'name',
    },
}

export async function categoriesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Category>
): Promise<IPaginatedResponse<CategoryConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    scope = await categoryConnectionQuery(scope, filter)

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

export async function categoryConnectionQuery(
    scope: SelectQueryBuilder<Category>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoin('Category.organization', 'Organization')
        }
        if (filterHasProperty('subjectId', filter)) {
            scope.innerJoin('Category.subjects', 'Subject')
        }
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                name: 'Category.name',
                system: 'Category.system',
                status: 'Category.status',
                organizationId: 'Organization.organization_id',
                subjectId: 'Subject.id',
            })
        )
    }

    return scope.select(categoryConnectionNodeFields)
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
