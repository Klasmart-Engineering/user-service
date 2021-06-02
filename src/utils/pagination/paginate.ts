const DEFAULT_PAGE_SIZE = 50
const SEEK_BACKWARD = 'BACKWARD'

export interface IPaginatedResponse<T = any> {
    totalCount: number
    pageInfo: {
        startCursor: string
        endCursor: string
        hasNextPage: boolean
        hasPreviousPage: boolean
    }
    edges: {
        cursor: string
        node: T
    }[]
}

interface directionArgs {
    count: number
    cursor?: string
}

const convertDataToCursor = (data: string) => {
    return Buffer.from(data).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return Buffer.from(cursor, 'base64').toString('ascii')
}

const getEdges = (data: any, cursorColumn: string) => {
    return data.map((d: any) => ({
        cursor: convertDataToCursor(d[cursorColumn]),
        node: d,
    }))
}

const forwardPaginate = async ({
    scope,
    pageSize,
    cursorTable,
    cursorColumn,
    cursorData,
}: any) => {
    const seekPageSize = pageSize + 1 //end cursor will point to this record
    const column = `"${cursorTable}"."${cursorColumn}"`

    if (cursorData) {
        scope.andWhere(`${column} > :cursorData`, { cursorData })
    }
    scope.orderBy({
        [`"${cursorTable}_${cursorColumn}"`]: 'ASC',
    })
    scope.take(seekPageSize)
    const data = await scope.getMany()
    const hasPreviousPage = cursorData ? true : false
    const hasNextPage = data.length > pageSize ? true : false
    let edges = getEdges(data, cursorColumn)
    const startCursor = edges.length > 0 ? edges[0].cursor : ''
    const endCursor =
        edges.length > 0
            ? edges.length < seekPageSize
                ? edges[edges.length - 1].cursor
                : edges[pageSize - 1].cursor
            : ''
    edges = edges.slice(0, pageSize)

    const pageInfo = {
        startCursor,
        endCursor,
        hasNextPage,
        hasPreviousPage,
    }
    return { edges, pageInfo }
}

const backwardPaginate = async ({
    scope,
    pageSize,
    totalCount,
    cursorTable,
    cursorColumn,
    cursorData,
}: any) => {
    // we try to get items one more than the page size
    const seekPageSize = pageSize + 1 //start cursor will point to this record
    const column = `"${cursorTable}"."${cursorColumn}"`

    if (cursorData) {
        scope.andWhere(`${column} < :cursorData`, { cursorData })
    }
    scope.orderBy({
        [`"${cursorTable}_${cursorColumn}"`]: 'DESC',
    })
    scope.take(seekPageSize)
    const data = await scope.getMany()
    data.reverse()

    const hasPreviousPage = data.length > pageSize ? true : false

    const hasNextPage = cursorData ? true : false

    let edges = getEdges(data, cursorColumn)
    edges = edges.length === seekPageSize ? edges.slice(1) : edges

    const startCursor = edges.length > 0 ? edges[0].cursor : ''
    const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : ''

    const pageInfo = {
        startCursor,
        endCursor,
        hasNextPage,
        hasPreviousPage,
    }
    return { edges, pageInfo }
}

export const paginateData = async ({
    direction,
    directionArgs,
    scope,
    cursorTable,
    cursorColumn,
}: any) => {
    const pageSize = directionArgs?.count
        ? directionArgs.count
        : DEFAULT_PAGE_SIZE
    const cursorData = directionArgs?.cursor
        ? getDataFromCursor(directionArgs.cursor)
        : null
    const totalCount = await scope.getCount()
    const { edges, pageInfo } =
        direction && direction === SEEK_BACKWARD
            ? await backwardPaginate({
                  scope,
                  totalCount,
                  pageSize,
                  cursorTable,
                  cursorColumn,
                  cursorData,
              })
            : await forwardPaginate({
                  scope,
                  pageSize,
                  cursorTable,
                  cursorColumn,
                  cursorData,
              })
    return {
        totalCount,
        edges,
        pageInfo,
    }
}
