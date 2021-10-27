import crypto from 'crypto'
import { BaseEntity, getManager, SelectQueryBuilder } from 'typeorm'
import { filterHasProperty } from '../utils/pagination/filtering'
import {
    getPageInfoAndEdges,
    getPaginationQuery,
    IChildPaginationArgs,
    IPaginatedResponse,
    IPaginationArgs,
} from '../utils/pagination/paginate'
import { ISortingConfig } from '../utils/pagination/sorting'
import { convertRawToEntities } from '../utils/typeorm'

// This file exposes a generic batch function for child connection dataloaders
// It accepts:
//  - an array of composite dataloader keys, each containing pagination args
//  - a function that generates the select statement for the pagination query
//  - a function to map from a typeorm entity to a connection node

// In order to pass request specific context to the batch function,
// dataloader keys are objects contain the keyId as well as
// request specific information, like pagination arguments
export interface IChildConnectionDataloaderKey<
    SourceEntity extends BaseEntity
> {
    readonly parent: {
        id: string
        filterKey: string
        pivot: string
    }
    readonly args: IChildPaginationArgs<SourceEntity>
    readonly includeTotalCount: boolean
}

// returns a deterministic request identifier for a dataloader object key
// a "request" is a group of dataloader keys that share the same arguments
// i.e. keys that originate from the same child connection request
// e.g.
// organizationsConnection {
//     usersConnection(count: 1) {} # request A
//     usersConnection(count: 2) {} # request B
// }
function getRequestIdentifier(key: IChildConnectionDataloaderKey<BaseEntity>) {
    // flatten the object and discard the scope property and unique parentId
    const flatObj = {
        direction: key.args.direction,
        count: key.args.count,
        cursor: key.args.cursor,
        filter: JSON.stringify(key.args.filter),
        sort: JSON.stringify(key.args.sort),
        includeTotalCount: key.includeTotalCount,
        parentPivot: key.parent.pivot,
        parentFilterKey: key.parent.filterKey,
    }
    return crypto
        .createHash('md5')
        .update(JSON.stringify(flatObj))
        .digest('hex')
}

interface IChildConnectionRequest<Node> {
    // the unique request properties
    key: IChildConnectionDataloaderKey<BaseEntity>
    // the list of parent Ids to filter by (e.g. orgIds in this case)
    parentIds: string[]
    // the final parentId:childConnections map for this unique request
    // this will be referenced when producing the final result to corresponding to each input key
    result: Map<string, IPaginatedResponse<Node>>
}
export const childConnectionLoader = async <Entity extends BaseEntity, Node>(
    keys: readonly IChildConnectionDataloaderKey<Entity>[],
    connectionQuery: (
        args: IPaginationArgs<Entity>
    ) => Promise<SelectQueryBuilder<Entity>>,
    entityToNodeMapFunction: (source: Entity) => Node | Promise<Node>,
    sort: ISortingConfig
): Promise<IPaginatedResponse<Node>[]> => {
    if (keys.length === 0) {
        return []
    }

    // group keys by request as described above
    const requests: Map<string, IChildConnectionRequest<Node>> = new Map()
    for (const key of keys) {
        const id = getRequestIdentifier(key)
        const request = requests.get(id)
        if (request) {
            request.parentIds.push(key.parent.id)
        } else {
            requests.set(id, {
                key,
                parentIds: [key.parent.id],
                result: new Map(),
            })
        }
    }

    // resolve all child connections independently per request, in parallel
    await Promise.all(
        Array.from(requests.entries()).map(async ([id, request]) => {
            // there may be duplicate parentIds, so use a unique set to create maps
            const parentIds = request.parentIds
            const uniqueParentIds = [...new Set(parentIds)]

            const args = request.key.args as IChildPaginationArgs<Entity>
            const parent = request.key.parent
            const includeTotalCount = request.key.includeTotalCount
            const groupByProperty = parent.pivot
            const pivotColumn = 'pivot'

            // not allowed to filter by the parent entity
            if (
                args.filter &&
                filterHasProperty(parent.filterKey, args.filter)
            ) {
                throw new Error(
                    `Cannot filter by parent ID ${parent.filterKey} in a child connection.`
                )
            }

            // Create the Dataloader map of parentId: childConnectionNode[]
            const parentMap = new Map<string, IPaginatedResponse<Node>>(
                uniqueParentIds.map((parentId) => [
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

            // Create the base scope with necessary joins, filters, and selects
            // Sorting and pagination is done separately in the paginationScope
            const baseScope = await connectionQuery({
                direction: args.direction || 'FORWARD',
                directionArgs: {
                    cursor: args.cursor,
                },
                scope: args.scope,
                filter: {
                    [parent.filterKey]: {
                        operator: 'in',
                        value: uniqueParentIds,
                    },
                    ...args.filter,
                },
            })

            //
            // Get the total counts per parent and update the dataloader map
            //
            if (includeTotalCount) {
                // Create the query to get total children counts per parent (ignores pagination filters etc)
                const countScope = baseScope
                    .clone()
                    .select([
                        `${groupByProperty} as "${pivotColumn}"`,
                        'count(*)',
                    ])
                    .addSelect('count(*)')
                    .groupBy(`"${pivotColumn}"`)

                // Get the counts and update the dataloader map
                const parentCounts: {
                    [pivotColumn]: string
                    count: string
                }[] = await countScope.getRawMany()
                for (const parentCount of parentCounts) {
                    const children = parentMap.get(parentCount[pivotColumn])
                    if (children) {
                        children.totalCount = parseInt(parentCount.count)
                    }
                }
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
                    ...sort,
                    sort: args.sort,
                },
                includeTotalCount: false,
            })
            // get one more item to determine if there is another page
            const seekPageSize = pageSize + 1

            // Select the row number to select n _sorted_ children per parent,
            // respecting the requested order
            const filterQuery = paginationScope.getQuery()
            // TODO a better way of extracting the ORDER BY clause
            const orderBy = filterQuery.slice(filterQuery.indexOf('ORDER BY'))

            paginationScope.addSelect(`${groupByProperty} as "${pivotColumn}"`)
            paginationScope.addSelect(
                `ROW_NUMBER() OVER (PARTITION BY ${groupByProperty} ${orderBy})`,
                'row_num'
            )

            // Create the query for getting n children per parents
            const childScope = getManager()
                .createQueryBuilder()
                .select('*')
                .from(`(${paginationScope.getQuery()})`, 'subquery')
                .where(`"row_num" <= ${seekPageSize}`)
                .setParameters(paginationScope.getParameters())

            // get raw SQL results and create a map of parentId:childEntity
            const childrenRaw: {
                [pivotColumn]: string
            }[] = await childScope.getRawMany()
            const entities = await convertRawToEntities(childrenRaw, baseScope)

            const parentToChildMap = new Map<string, Entity[]>(
                uniqueParentIds.map((id) => [id, []])
            )
            childrenRaw.forEach((childRaw, index) => {
                const entity = entities[index]
                if (entity) {
                    const parentId = childRaw[pivotColumn]
                    const children = parentToChildMap.get(parentId)
                    children?.push(entity)
                    parentToChildMap.set(parentId, children || [])
                }
            })

            // for each parent, calculate their edges and page info
            for (const [parentId, children] of parentToChildMap) {
                const { pageInfo, edges } = getPageInfoAndEdges<Entity>(
                    children,
                    pageSize,
                    sort.primaryKey,
                    primaryColumns,
                    parentMap.get(parentId)?.totalCount ?? 0,
                    cursorData,
                    args.direction
                )

                const parentResult = parentMap.get(parentId)
                if (parentResult) {
                    for (const edge of edges) {
                        const processedEdge = {
                            cursor: edge.cursor,
                            node: await entityToNodeMapFunction(edge.node),
                        }
                        parentResult.edges.push(processedEdge)
                    }
                    parentResult.pageInfo = pageInfo
                }
            }

            request.result = parentMap
        })
    )

    // finally, map the request results to the dataloader input keys
    const finalResult: IPaginatedResponse<Node>[] = []
    for (const key of keys) {
        // find the request
        const id = getRequestIdentifier(key)
        const request = requests.get(id)

        // get the result for the requested parentId
        const result = request?.result.get(key.parent.id)
        finalResult.push(result!)
    }
    return finalResult
}
