/* eslint-disable @typescript-eslint/no-explicit-any */
import { getManager, SelectQueryBuilder } from 'typeorm'
import {
    getPageInfoAndEdges,
    getPaginationQuery,
    IChildPaginationArgs,
    IPaginatedResponse,
} from '../utils/pagination/paginate'
import { ISortingConfig } from '../utils/pagination/sorting'

export const childConnectionLoader = async (
    parentIds: string[],
    baseScope: SelectQueryBuilder<unknown>,
    groupByProperty: string,
    tablePrefix: string,
    entityMapper: (item: any) => any,
    args: IChildPaginationArgs<any>,
    sortConfig: ISortingConfig
) => {
    // const requestedChildCount = args.count ?? 50

    // Create our Dataloader map of parentId: childConnectionNode[]
    const parentMap = new Map<string, IPaginatedResponse>(
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

    //
    // Get the total counts per parent and update the dataloader map
    //

    // select the parentId to group by
    baseScope.addSelect(`${groupByProperty} as "parentId"`)

    // Create the query to get total children counts per parent (ignores pagination filters etc)
    const countScope = getManager()
        .createQueryBuilder()
        .select(['"parentId"', 'count(*)'])
        .from(`(${baseScope.getQuery()})`, 'subquery')
        .groupBy('"parentId"')
        .setParameters(baseScope.getParameters())

    // Get the counts and update the dataloader map
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
    // Get the children per parent and update the dataloader map
    //

    // apply pagination where clause and order by statements to the scope
    const {
        scope: paginationScope,
        pageSize,
        primaryColumns,
        cursorData,
    } = await getPaginationQuery({
        direction: args.direction || 'FORWARD',
        directionArgs: {
            count: args.count,
            cursor: args.cursor,
        },
        scope: baseScope.clone(),
        sort: {
            ...sortConfig,
            sort: args.sort,
        },
        includeTotalCount: false,
    })
    // get one more item to determine if there is another page
    const seekPageSize = pageSize + 1

    // // always paginate FORWARDS
    // paginationScope.take(pageSize)

    // Select the parentId, which will be used to pivot by when
    // calculating counts and children per parent
    paginationScope.addSelect(`${groupByProperty} as "parentId"`)

    // Select the row number to select n children per parent, respecting the requested order
    const filterQuery = paginationScope.getQuery()
    const orderBy = filterQuery.slice(filterQuery.indexOf('ORDER BY')) // TODO this better...
    paginationScope.addSelect(
        `ROW_NUMBER() OVER (PARTITION BY ${groupByProperty} ${orderBy})`,
        'row_num'
    )

    // Create the query for getting children per parents
    const childScope = getManager()
        .createQueryBuilder()
        .select('*')
        .from(`(${paginationScope.getQuery()})`, 'subquery')
        .where(`"row_num" <= ${seekPageSize}`)
        .setParameters(paginationScope.getParameters())

    const childrenRaw = await childScope.getRawMany()

    // convert from sql column aliases to column names
    // e.g. User_user_id -> user_id
    // this is rather ugly, can we do better?
    const childrenProcessed = childrenRaw.map((child) => {
        return JSON.parse(JSON.stringify(child).replaceAll(tablePrefix, ''))
    })

    // create a map of parentId:rawChildSqlRow
    const parentToRawChildMap = new Map<string, any[]>(
        parentIds.map((id) => [id, []])
    )
    for (const child of childrenProcessed) {
        const parentId = child.parentId as string
        const children = parentToRawChildMap.get(parentId)
        children?.push(child)
        parentToRawChildMap.set(parentId, children || [])
    }

    // for each parent, calculate their edges and page info
    for (const [parentId, children] of parentToRawChildMap) {
        const { pageInfo, edges } = getPageInfoAndEdges(
            children,
            pageSize,
            sortConfig.primaryKey,
            primaryColumns,
            parentMap.get(parentId)?.totalCount || 0,
            cursorData,
            args.direction
        )

        const parent = parentMap.get(parentId)
        if (parent) {
            parent.edges = edges.map((edge) => {
                return {
                    cursor: edge.cursor,
                    node: entityMapper(edge.node),
                }
            })
            parent.pageInfo = pageInfo
        }
    }

    return Array.from(parentMap.values())
}
