import { getManager, SelectQueryBuilder } from 'typeorm'

export const childConnectionLoader = async (
    parentIds: string[],
    scope: SelectQueryBuilder<unknown>,
    groupByProperty: string,
    childCount: number,
    tablePrefix: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entityMapper: (item: any) => any
) => {
    const parentMap = new Map<string, unknown>(
        parentIds.map((parentId) => [
            parentId,
            {
                totalCount: 0,
                edges: [],
            },
        ])
    )

    scope.addSelect(
        `ROW_NUMBER() OVER (PARTITION BY ${groupByProperty})`,
        'row_num'
    )

    scope.addSelect(`${groupByProperty} as "parentId"`)

    const childScope = getManager()
        .createQueryBuilder()
        .from(`(${scope.getQuery()})`, 'subquery')
        .where(`"row_num" <= ${childCount}`)
        .setParameters(scope.getParameters())

    const countScope = getManager()
        .createQueryBuilder()
        .select(['"parentId"', 'count(*)'])
        .from(`(${scope.getQuery()})`, 'subquery')
        .groupBy('"parentId"')
        .setParameters(scope.getParameters())

    const childrenRaw = await childScope.getRawMany()
    const parentCounts = await countScope.getRawMany()

    for (const parent of parentCounts) {
        parentMap.set(parent.parentId, {
            totalCount: parent.count,
            edges: [],
        })
    }

    for (const child of childrenRaw) {
        const parentId = child.parentId
        const parsedNode = JSON.parse(
            JSON.stringify(child).replaceAll(tablePrefix, '')
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapItem = parentMap.get(parentId) as any
        mapItem?.edges.push({
            cursor: '',
            node: entityMapper(parsedNode),
        })
    }

    return Array.from(parentMap.values())
}
