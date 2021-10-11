/* eslint-disable @typescript-eslint/no-explicit-any */
import { getManager, SelectQueryBuilder } from 'typeorm'
import {
    getEdges,
    getPaginationQuery,
    IPaginationArgs,
} from '../utils/pagination/paginate'
import { ISortingConfig } from '../utils/pagination/sorting'

export const childConnectionLoader = async (
    parentIds: string[],
    baseScope: SelectQueryBuilder<unknown>,
    groupByProperty: string,
    tablePrefix: string,
    entityMapper: (item: any) => any,
    args: IPaginationArgs<any>,
    sortConfig: ISortingConfig
) => {
    const childCount = args.directionArgs?.count ?? 50

    const whereQuery = await getPaginationQuery({
        direction: 'FORWARD',
        directionArgs: {
            count: 1000000000,
            cursor: args.directionArgs?.cursor,
        },
        scope: baseScope.clone(),
        sort: {
            ...sortConfig,
            sort: args.sort,
        },
        includeTotalCount: false,
    })
    whereQuery.scope.take(whereQuery.pageSize)

    // Create our Dataloader map
    const parentMap = new Map<string, any>(
        parentIds.map((parentId) => [
            parentId,
            {
                totalCount: 0,
                pageInfo: {
                    hasPreviousPage: true,
                    hasNextPage: true,
                    startCursor: '',
                    endCursor: '',
                },
                edges: [],
            },
        ])
    )

    // Select the parentId to pivot by
    baseScope.addSelect(`${groupByProperty} as "parentId"`)
    whereQuery.scope.addSelect(`${groupByProperty} as "parentId"`)

    // Select the row number to select n children per parent, respecting the request order
    const filterQuery = whereQuery.scope.getQuery()
    const orderBy = filterQuery.slice(filterQuery.indexOf('ORDER BY'))
    whereQuery.scope.addSelect(
        `ROW_NUMBER() OVER (PARTITION BY ${groupByProperty} ${orderBy})`,
        'row_num'
    )

    // Create the query for getting children per parents
    const childScope = getManager()
        .createQueryBuilder()
        .select('*')
        .from(`(${whereQuery.scope.getQuery()})`, 'subquery')
        .where(`"row_num" <= ${childCount}`)
        .setParameters(whereQuery.scope.getParameters())

    // Create the query to get total children counts per parent (ignores pagination filters etc)
    const countScope = getManager()
        .createQueryBuilder()
        .select(['"parentId"', 'count(*)'])
        .from(`(${baseScope.getQuery()})`, 'subquery')
        .groupBy('"parentId"')
        .setParameters(baseScope.getParameters())

    //
    // Get the counts and update the dataloader map
    //
    const parentCounts = await countScope.getRawMany()
    for (const parent of parentCounts) {
        parentMap.set(parent.parentId, {
            totalCount: parent.count,
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: true,
                startCursor: '',
                endCursor: '',
            },
            edges: [],
        })
    }

    //
    // Get the children and convert to the expected format with pagination edges and cursors
    //
    const childrenRaw = await childScope.getRawMany()
    // convert from sql column aliases to column names
    const childrenProcessed = childrenRaw.map((child) => {
        return JSON.parse(JSON.stringify(child).replaceAll(tablePrefix, ''))
    })

    const edges = getEdges(
        childrenProcessed,
        sortConfig.primaryKey,
        whereQuery.primaryColumns
    )

    for (const edge of edges) {
        const parentId = edge.node.parentId
        const mapItem = parentMap.get(parentId) as any

        mapItem?.edges.push({
            cursor: edge.cursor,
            node: entityMapper(edge.node),
        })
    }

    // calculate page cursors
    for (const [, value] of parentMap) {
        value.pageInfo.startCursor = value.edges.length
            ? value.edges[0].cursor
            : ''
        value.pageInfo.endCursor = value.edges.length
            ? value.edges[value.edges.length - 1].cursor
            : ''
    }

    return Array.from(parentMap.values())
}
