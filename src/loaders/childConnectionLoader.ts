import { getManager, SelectQueryBuilder } from 'typeorm'
import { getEdges } from '../utils/pagination/paginate'

export const childConnectionLoader = async (
    parentIds: string[],
    baseScope: SelectQueryBuilder<unknown>,
    filteredScope: SelectQueryBuilder<unknown>,
    groupByProperty: string,
    childCount: number,
    tablePrefix: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entityMapper: (item: any) => any,
    primaryColumns: string[]
) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // return query
    baseScope.addSelect(`${groupByProperty} as "parentId"`)
    filteredScope.addSelect(`${groupByProperty} as "parentId"`)

    const filterQuery = filteredScope.getQuery()
    // TODO this better....
    const orderBy = filterQuery.slice(filterQuery.indexOf('ORDER BY'))

    filteredScope.addSelect(
        `ROW_NUMBER() OVER (PARTITION BY ${groupByProperty} ${orderBy})`,
        'row_num'
    )

    const childScope = getManager()
        .createQueryBuilder()
        .select('*')
        .from(`(${filteredScope.getQuery()})`, 'subquery')
        .where(`"row_num" <= ${childCount}`)
        .setParameters(filteredScope.getParameters())

    const countScope = getManager()
        .createQueryBuilder()
        .select(['"parentId"', 'count(*)'])
        .from(`(${baseScope.getQuery()})`, 'subquery')
        .groupBy('"parentId"')
        .setParameters(baseScope.getParameters())

    const childrenRaw = await childScope.getRawMany()
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

    // convert from sql column aliases to column names
    const childrenProcessed = childrenRaw.map((child) => {
        return JSON.parse(JSON.stringify(child).replaceAll(tablePrefix, ''))
    })

    const edges = getEdges(childrenProcessed, 'user_id', primaryColumns)

    for (const edge of edges) {
        const parentId = edge.node.parentId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapItem = parentMap.get(parentId) as any

        // TODO cursors....
        mapItem?.edges.push({
            cursor: edge.cursor,
            node: entityMapper(edge.node),
        })
    }
    // throw new Error('test')
    for (const [parentId, value] of parentMap) {
        value.pageInfo.startCursor = value.edges.length
            ? value.edges[0].cursor
            : ''
        value.pageInfo.endCursor = value.edges.length
            ? value.edges[value.edges.length - 1].cursor
            : ''
    }

    return Array.from(parentMap.values())
}
