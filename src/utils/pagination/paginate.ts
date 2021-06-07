import { SelectQueryBuilder, BaseEntity } from 'typeorm'
import { IEntityFilter } from './filtering'
import { addOrderByClause, ISortingConfig, ISortField } from './sorting'

const DEFAULT_PAGE_SIZE = 50
const SEEK_BACKWARD = 'BACKWARD'

export type Direction = 'FORWARD' | 'BACKWARD'

export interface IPaginatable {
    pagination_cursor?: string
}

export interface IPaginateData {
    direction: Direction
    directionArgs?: directionArgs
    scope: SelectQueryBuilder<any>
    sort: ISortingConfig
}

interface IPaginationOptions {
    scope: SelectQueryBuilder<any>
    pageSize: number
    cursorData: any
}

export interface IPaginationArgs<Entity extends BaseEntity = any> {
    direction: Direction
    directionArgs: directionArgs
    scope: SelectQueryBuilder<Entity>
    filter?: IEntityFilter
    sortBy?: ISortField
}

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

export const convertDataToCursor = (data: string) => {
    return Buffer.from(data).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return Buffer.from(cursor, 'base64').toString('ascii')
}

const getEdges = (data: any) => {
    return data.map((d: any) => {
        const cursor = `pagination_cursor`
        console.log('cursor: ', d[cursor])
        return {
            cursor: convertDataToCursor(d[cursor]),
            node: d,
        }
    })
}

const forwardPaginate = async ({
    scope,
    pageSize,
    // cursorColumn,
    // sortByColumn,
    cursorData,
}: IPaginationOptions) => {
    const seekPageSize = pageSize + 1 //end cursor will point to this record

    scope.take(seekPageSize)
    const data = await scope.getMany()
    const hasPreviousPage = cursorData ? true : false
    const hasNextPage = data.length > pageSize ? true : false
    let edges = getEdges(data)
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
    cursorData,
}: IPaginationOptions) => {
    // we try to get items one more than the page size
    const seekPageSize = pageSize + 1 //start cursor will point to this record

    scope.take(seekPageSize)
    const data = await scope.getMany()
    data.reverse()

    const hasPreviousPage = data.length > pageSize ? true : false

    const hasNextPage = cursorData ? true : false

    let edges = getEdges(data)
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

export const paginateData = async <T = any>({
    direction,
    directionArgs,
    scope,
    sort,
}: IPaginateData): Promise<IPaginatedResponse<T>> => {
    const pageSize = directionArgs?.count
        ? directionArgs.count
        : DEFAULT_PAGE_SIZE

    const cursorData = directionArgs?.cursor
        ? getDataFromCursor(directionArgs.cursor)
        : null

    const totalCount = await scope.getCount()

    const { order, computedCursorColumn } = addOrderByClause(
        scope,
        sort,
        direction
    )

    const directionOperator = order === 'ASC' ? '>' : '<'
    if (cursorData) {
        scope.andWhere(`${computedCursorColumn} ${directionOperator} :value`, {
            value: cursorData,
        })
    }

    const { edges, pageInfo } =
        direction && direction === SEEK_BACKWARD
            ? await backwardPaginate({
                  scope,
                  pageSize,
                  cursorData,
              })
            : await forwardPaginate({
                  scope,
                  pageSize,
                  cursorData,
              })
    return {
        totalCount,
        edges,
        pageInfo,
    }
}
