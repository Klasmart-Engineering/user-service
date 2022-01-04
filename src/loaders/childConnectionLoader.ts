import crypto from 'crypto'
import { BaseEntity, getManager, SelectQueryBuilder } from 'typeorm'
import { createEntityScope, ICreateScopeArgs } from '../directives/isAdmin'
import { filterHasProperty, IEntityFilter } from '../utils/pagination/filtering'
import {
    getEmptyPaginatedResponse,
    getPageInfoAndEdges,
    getPaginationQuery,
    IChildPaginationArgs,
    IPaginatedResponse,
} from '../utils/pagination/paginate'
import { ISortingConfig } from '../utils/pagination/sorting'
import { objectToKey } from '../utils/stringUtils'
import { convertRawToEntities } from '../utils/typeorm'

// This file exposes a generic batch function for child connection dataloaders
// It accepts:
//  - an array of composite dataloader keys, each containing pagination args
//  - a function that generates the select statement for the pagination query
//  - a function to map from a typeorm entity to a connection node

// In order to pass request specific context to the batch function,
// dataloader keys are objects contain the keyId as well as
// request specific information, like pagination arguments
export interface IChildConnectionDataloaderKey<Entity extends BaseEntity> {
    readonly parent: {
        id: string
        filterKey: string
        pivot: string
    }
    readonly args: IChildPaginationArgs
    readonly includeTotalCount: boolean
    readonly primaryColumn: keyof Entity
    // specify the system entity column to include system entities in the results
    readonly systemColumn?: keyof Entity
}

// most child connections filter on their parents using a single column (normally the parents primary key)
// this exposes a simpler interface for that case
export const childConnectionLoader = async <Entity extends BaseEntity, Node>(
    keys: readonly IChildConnectionDataloaderKey<Entity>[],
    connectionQuery: (
        scope: SelectQueryBuilder<Entity>,
        filter?: IEntityFilter
    ) => Promise<SelectQueryBuilder<Entity>>,
    entityToNodeMapFunction: (source: Entity) => Node | Promise<Node>,
    sort: ISortingConfig,
    scopeArgs: ICreateScopeArgs
): Promise<IPaginatedResponse<Node>[]> => {
    const keysWithCompositeIds: ICompositeIdChildConnectionDataloaderKey<Entity>[] = keys.map(
        (k) => {
            return {
                parent: {
                    compositeId: [k.parent.id],
                    filterKeys: [k.parent.filterKey],
                    pivots: [k.parent.pivot],
                },
                args: k.args,
                includeTotalCount: k.includeTotalCount,
                primaryColumn: k.primaryColumn,
                systemColumn: k.systemColumn,
            }
        }
    )

    return multiKeyChildConnectionLoader(
        keysWithCompositeIds,
        connectionQuery,
        entityToNodeMapFunction,
        sort,
        scopeArgs
    )
}

export interface ICompositeIdChildConnectionDataloaderKey<
    Entity extends BaseEntity
> {
    // the arrays in parent must use the same order
    // compositeId[n] much be for the same column as filterkeys[n] and piviot[n]
    readonly parent: {
        // values used to uniquely identify the parent for filtering and grouping child rows
        // each parent can supply more then one value to support composite primary keys
        compositeId: string[]
        filterKeys: string[]
        pivots: string[]
    }
    readonly args: IChildPaginationArgs
    readonly includeTotalCount: boolean
    readonly primaryColumn: keyof Entity
    readonly systemColumn?: keyof Entity
}
interface IChildConnectionRequest<Node, Entity extends BaseEntity> {
    // the unique request properties
    key: ICompositeIdChildConnectionDataloaderKey<Entity>
    // composite keys to identify each parent
    parentCompositeIds: string[][]
    // the final parentId:childConnections map for this unique request
    // this will be referenced when producing the final result to corresponding to each input key
    result: Map<string, IPaginatedResponse<Node>>

    // used for deduplication
    primaryColumn: keyof Entity

    // specify the system entity column to include system entities in the results
    systemColumn?: keyof Entity
}

interface ISystemEntity {
    system?: boolean
    system_role?: boolean
}

// returns a deterministic request identifier for a dataloader object key
// a "request" is a group of dataloader keys that share the same arguments
// i.e. keys that originate from the same child connection request
// e.g.
// organizationsConnection {
//     usersConnection(count: 1) {} # request A
//     usersConnection(count: 2) {} # request B
// }
function getRequestIdentifier<Entity extends BaseEntity>(
    key: ICompositeIdChildConnectionDataloaderKey<Entity>
) {
    // flatten the object and discard the scope property and unique parentId
    const flatObj = {
        direction: key.args.direction,
        count: key.args.count,
        cursor: key.args.cursor,
        filter: objectToKey(key.args.filter || {}),
        sort: objectToKey(key.args.sort || {}),
        includeTotalCount: key.includeTotalCount,
        parentPivot: key.parent.pivots,
        parentFilterKey: key.parent.filterKeys,
    }
    return crypto.createHash('md5').update(objectToKey(flatObj)).digest('hex')
}

// this is used to create a single string for composite keys
// which is useful for Map objects
function createSingleLookUpKey(compositeId: unknown[]): string {
    return JSON.stringify(compositeId)
}

export const multiKeyChildConnectionLoader = async <
    Entity extends BaseEntity,
    Node
>(
    keys: readonly ICompositeIdChildConnectionDataloaderKey<Entity>[],
    connectionQuery: (
        scope: SelectQueryBuilder<Entity>,
        filter?: IEntityFilter
    ) => Promise<SelectQueryBuilder<Entity>>,
    entityToNodeMapFunction: (source: Entity) => Node | Promise<Node>,
    sort: ISortingConfig,
    scopeArgs: ICreateScopeArgs
): Promise<IPaginatedResponse<Node>[]> => {
    if (keys.length === 0) {
        return []
    }

    // group keys by request as described above
    const requests: Map<
        string,
        IChildConnectionRequest<Node, Entity>
    > = new Map()
    for (const key of keys) {
        const requestId = getRequestIdentifier(key)
        const request = requests.get(requestId)
        if (request) {
            request.parentCompositeIds.push(key.parent.compositeId)
        } else {
            requests.set(requestId, {
                key,
                parentCompositeIds: [key.parent.compositeId],
                result: new Map(),
                primaryColumn: key.primaryColumn,
                systemColumn: key.systemColumn,
            })
        }
    }

    // resolve all child connections independently per request, in parallel
    await Promise.all(
        Array.from(requests.values()).map(async (request) => {
            // create a new scope per request
            const scope = (await createEntityScope(
                scopeArgs
            )) as SelectQueryBuilder<Entity>

            // there may be duplicate parentIds, so use a unique set to create maps
            const parentLookUpKeys = request.parentCompositeIds.map(
                (compositeId) => createSingleLookUpKey(compositeId)
            )
            const uniqueParentLookUpKeys = [...new Set(parentLookUpKeys)]

            const args = request.key.args
            const parent = request.key.parent
            const includeTotalCount = request.key.includeTotalCount
            const primaryColumn = request.primaryColumn
            const systemColumnString = `${scope.alias}.${request.systemColumn}`

            // not allowed to filter by the parent entity
            for (const filterKey of parent.filterKeys) {
                if (args.filter && filterHasProperty(filterKey, args.filter)) {
                    throw new Error(
                        `Cannot filter by parent property ${filterKey} in this child connection.`
                    )
                }
            }

            // Create the Dataloader map of parentId: childConnectionNode[]
            const parentMap = new Map<string, IPaginatedResponse<Node>>(
                uniqueParentLookUpKeys.map((parentLookUpKey) => [
                    parentLookUpKey,
                    getEmptyPaginatedResponse<Node>(
                        includeTotalCount ? 0 : undefined
                    ),
                ])
            )

            // Create the base scope with necessary joins, filters, and selects
            // Sorting and pagination is done separately in the paginationScope

            const filter = {
                ...args.filter,
            }

            for (const [index, filterKey] of parent.filterKeys.entries()) {
                const uniqueFilterValue: Set<string> = new Set()
                for (const parentCompositeId of request.parentCompositeIds) {
                    uniqueFilterValue.add(parentCompositeId[index])
                }

                filter[filterKey] = {
                    operator: 'in',
                    value: [...uniqueFilterValue],
                }
            }

            const baseScope = await connectionQuery(scope, filter)
            if (request.systemColumn) {
                baseScope.orWhere(`${systemColumnString} = true`)
            }
            const table = baseScope.expressionMap.mainAlias?.name

            //
            // Get the total counts per parent and update the dataloader map
            //
            const pivots = []
            const groupBys: string[] = []
            const groupByProperties = parent.pivots
            const groupByString = groupByProperties.join(',')
            for (const [index, piviot] of groupByProperties.entries()) {
                pivots.push(`${piviot} as "piviot${index}"`)
                groupBys.push(`piviot${index}`)
            }
            if (includeTotalCount) {
                const systemColumnAlias = 'systemColumn'
                // Create the query to get total children counts per parent (ignores pagination filters etc)
                const countScope = baseScope
                    .clone()
                    .select(pivots)
                    .addSelect(`COUNT(DISTINCT "${table}"."${primaryColumn}")`)
                    .groupBy(groupByString)

                if (request.systemColumn) {
                    countScope.addGroupBy(systemColumnString)
                    countScope.addSelect(systemColumnString, systemColumnAlias)
                }

                // Get the counts and update the dataloader map
                const parentCounts: {
                    [groupBy: string]: unknown
                    [systemColumnAlias]?: boolean
                    count: string
                }[] = await countScope.getRawMany()
                for (const parentCount of parentCounts) {
                    const piviotValues = groupBys.map(
                        (column) => parentCount[column]
                    )

                    const children = parentMap.get(
                        createSingleLookUpKey(piviotValues)
                    )
                    if (children) {
                        children.totalCount = parseInt(parentCount.count)
                    }
                }

                if (request.systemColumn) {
                    // add total system entity count to each parent
                    const systemEntityCounts = parentCounts.filter(
                        (p) => p[systemColumnAlias] === true
                    )
                    if (systemEntityCounts.length > 0) {
                        const totalSystemCount = systemEntityCounts.reduce(
                            (prev, curr) => prev + parseInt(curr.count),
                            0
                        )
                        parentMap.forEach((value) => {
                            value.totalCount = value.totalCount
                                ? value.totalCount + totalSystemCount
                                : totalSystemCount
                        })
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

            paginationScope.addSelect(pivots)
            paginationScope.addSelect(
                `ROW_NUMBER() OVER (PARTITION BY ${groupByString} ${orderBy})`,
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
                [column: string]: string
            }[] = await childScope.getRawMany()

            const entities = await convertRawToEntities(childrenRaw, baseScope)

            const parentToChildMap = new Map<string, Entity[]>(
                uniqueParentLookUpKeys.map((id) => [id, []])
            )
            function addChild(parentKey: string, child: Entity) {
                const children = parentToChildMap.get(parentKey)
                const isDupe = children?.find((c) => {
                    return c[primaryColumn] === child[primaryColumn!]
                })
                // there may be duplicates across parents (e.g same user across orgs)
                // but we must deduplicate per parent (e.g. unique users per org)
                if (!isDupe) {
                    children?.push(child)
                    parentToChildMap.set(parentKey, children || [])
                }
            }
            childrenRaw.forEach((childRaw, index) => {
                const entity = entities[index]
                if (entity) {
                    // check if this is a system entity
                    // if so, add to all parents
                    const isSystemEntity =
                        (entity as ISystemEntity).system ||
                        (entity as ISystemEntity).system_role
                    if (request.systemColumn && isSystemEntity) {
                        parentToChildMap.forEach((children, key) => {
                            addChild(key, entity)
                        })
                    } else {
                        const piviotValues: string[] = groupBys.map(
                            (column) => childRaw[column]
                        )
                        const parentLookUpKey = createSingleLookUpKey(
                            piviotValues
                        )
                        addChild(parentLookUpKey, entity)
                    }
                }
            })

            // for each parent, calculate their edges and page info
            for (const [parentLookUpKey, children] of parentToChildMap) {
                const { pageInfo, edges } = getPageInfoAndEdges<Entity>(
                    children,
                    pageSize,
                    sort.primaryKey,
                    primaryColumns,
                    cursorData,
                    parentMap.get(parentLookUpKey)?.totalCount ?? 0,
                    args.direction
                )

                const parentResult = parentMap.get(parentLookUpKey)
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
        const result = request?.result.get(
            createSingleLookUpKey(key.parent.compositeId)
        )
        finalResult.push(result!)
    }
    return finalResult
}
