export const START_KEY = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
export const END_KEY = '00000000-0000-0000-0000-000000000000'

export interface stringable {
    toString(): string
}

export class CursorObject<K> {
    id: K
    timeStamp?: number
    total?: number
    constructor(id: K, total?: number, stamp?: number) {
        this.id = id
        this.timeStamp = stamp
        this.total = total
    }
}

export const toCursorHash = (co: CursorObject<any>): string => {
    const s = JSON.stringify(co)
    return Buffer.from(s).toString('base64')
}

export function fromCursorHash(s: string): CursorObject<any> {
    const json = Buffer.from(s, 'base64').toString('ascii')
    return JSON.parse(json) as CursorObject<any>
}

const totalRefresh = 5

export function staleCursorTotal(c: CursorObject<any>): boolean {
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
export class Paginated<T extends Paginatable<T, K>, K extends stringable> {
    public total: number
    public edges: Array<T>
    public pageInfo: PageInfo

    constructor(
        startId: K,
        endId: K,
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
                    : toCursorHash(new CursorObject<K>(endId)),
            startCursor:
                this.edges.length > 0
                    ? this.edges[0].generateCursor(total, timestamp)
                    : toCursorHash(new CursorObject<K>(startId)),
        }
    }
}

export const DEFAULT_PAGE_SIZE = 100

// Public API
export function paginateData<T extends Paginatable<T, K>, K extends stringable>(
    count: number,
    timestamp: number,
    data: T[],
    isSorted: boolean,
    limit: number,
    startKey: K,
    endKey: K,
    before?: K,
    after?: K
): Paginated<T, K> {
    let sortedData = data
    if (!isSorted) {
        sortedData = data.sort((a, b) => a.compare(b))
    }

    // Throwing out values that are too big or small
    const restrictedData = applyCursorsToEdges(sortedData, before, after)

    let hasMoreDataBefore = false
    let hasMoreDataAfter = false
    if (after !== undefined) {
        hasMoreDataBefore = after !== startKey
        hasMoreDataAfter = restrictedData.length > limit
    } else if (before !== undefined) {
        hasMoreDataAfter = before !== endKey
        hasMoreDataBefore = restrictedData.length > limit
    }
    // Restricting the data to the specified page size
    const paginatedData = edgesToReturn(restrictedData, limit, before, after)

    const pageInfo = new Paginated(
        startKey,
        endKey,
        count,
        timestamp,
        paginatedData,
        hasMoreDataAfter,
        hasMoreDataBefore
    )
    return pageInfo
}

// https://relay.dev/graphql/connections.htm#sec-Pagination-algorithm
function applyCursorsToEdges<T extends Paginatable<T, K>, K extends stringable>(
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
function edgesToReturn<T extends Paginatable<T, K>, K extends stringable>(
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
