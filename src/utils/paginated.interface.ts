export class CursorObject {
    id: string
    timeStamp?: number
    total?: number
    constructor(id: string, total?: number, stamp?: number) {
        this.id = id || '00000000-0000-0000-0000-000000000000'
        this.timeStamp = stamp
        this.total = total
    }
}

export const toCursorHash = (co: CursorObject): string => {
    const s = JSON.stringify(co)
    return Buffer.from(s).toString('base64')
}

export function fromCursorHash(s: string): CursorObject {
    const json = Buffer.from(s, 'base64').toString('ascii')
    return JSON.parse(json) as CursorObject
}

export const START_CURSOR = toCursorHash(
    new CursorObject('ffffffff-ffff-ffff-ffff-ffffffffffff')
)

export const END_CURSOR = toCursorHash(
    new CursorObject('00000000-0000-0000-0000-000000000000')
)

const totalRefresh = 5

export function staleCursorTotal(c: CursorObject): boolean {
    return (
        c.timeStamp === undefined ||
        Date.now() - c.timeStamp < totalRefresh ||
        c.total === undefined ||
        c.total === 0
    )
}
export interface Paginatable<T, K> {
    [x: string]: any
    compare(rhs: T): number
    compareKey(rhs: K): number
    generateCursor(total?: number, timestamp?: number): string
}
export class Paginated<T extends Paginatable<T, K>, K> {
    public total: number
    public edges: Array<T>
    public pageInfo: PageInfo

    constructor(
        total?: number,
        timestamp?: number,
        data?: T[],
        hasNextPage?: boolean,
        hasPreviousPage?: boolean
    ) {
        this.total = total || 0
        this.edges = data || []
        this.pageInfo = {
            hasNextPage: hasNextPage || false,
            hasPreviousPage: hasPreviousPage || false,
            endCursor:
                this.edges.length > 0
                    ? this.edges[this.edges.length - 1].generateCursor(
                          total,
                          timestamp
                      )
                    : END_CURSOR,
            startCursor:
                this.edges.length > 0
                    ? this.edges[0].generateCursor(total, timestamp)
                    : START_CURSOR,
        }
    }
}

export const DEFAULT_PAGE_SIZE = 100

// Public API
export function paginateData<T extends Paginatable<T, K>, K>(
    count: number,
    timestamp: number,
    data: T[],
    isSorted: boolean,
    limit: number,
    before?: K,
    after?: K
): Paginated<T, K> {
    let sortedData = data
    if (!isSorted) {
        sortedData = data.sort((a, b) => a.compare(b))
    }

    let hasMoreDataBefore = false
    let hasMoreDataAfter = false
    if (after) {
        hasMoreDataBefore = sortedData[0].compareKey(after) === 0
        hasMoreDataAfter =
            (hasMoreDataBefore && sortedData.length > limit + 1) ||
            sortedData.length > limit
    } else if (before) {
        hasMoreDataAfter =
            sortedData[sortedData.length - 1].compareKey(before) === 0
        hasMoreDataBefore =
            (hasMoreDataAfter && sortedData.length > limit + 1) ||
            sortedData.length > limit
    }

    // Throwing out values that are too big or small
    const restrictedData = applyCursorsToEdges(sortedData, before, after)

    // Restricting the data to the specified page size
    const paginatedData = edgesToReturn(restrictedData, limit, before, after)

    const pageInfo = new Paginated(
        count,
        timestamp,
        paginatedData,
        hasMoreDataAfter,
        hasMoreDataBefore
    )
    return pageInfo
}

// https://relay.dev/graphql/connections.htm#sec-Pagination-algorithm
function applyCursorsToEdges<T extends Paginatable<T, K>, K>(
    sortedData: T[],
    before?: K,
    after?: K
): T[] {
    if (after) {
        let i = 0
        for (i; i < sortedData.length; i++) {
            if (sortedData[i].compareKey(after) <= 0) {
                continue
            } else {
                break
            }
        }
        sortedData = sortedData.slice(i)
    }
    if (before) {
        let j = sortedData.length - 1
        for (j; j >= 0; j--) {
            if (sortedData[j].compareKey(before) >= 0) {
                continue
            } else {
                break
            }
        }
        sortedData = sortedData.slice(0, j + 1)
    }
    return sortedData
}

// https://relay.dev/graphql/connections.htm#sec-Pagination-algorithm
function edgesToReturn<T extends Paginatable<T, K>, K>(
    sortedData: T[],
    limit: number,
    before?: K,
    after?: K
): T[] {
    if (sortedData.length > limit) {
        if (after) {
            sortedData = sortedData.slice(0, limit)
        } else {
            sortedData = sortedData.slice(-limit)
        }
    }
    return sortedData
}

export class PageInfo {
    hasPreviousPage?: boolean
    hasNextPage?: boolean
    startCursor?: string
    endCursor?: string
}

export class CursorArgs {
    after?: string
    first?: number
    before?: string
    last?: number
    organization_ids?: string[]
}
