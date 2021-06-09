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
    defaultColumn: string
    primaryColumn: string
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

export const convertDataToCursor = (data: Record<string, unknown>) => {
    if (!data) {
        return ''
    }
    return Buffer.from(JSON.stringify(data)).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'))
}

const getEdges = (data: any, defaultColumn: string, primaryColumn: string) => {
    return data.map((d: any) => {
        let paginationData = d['pagination_cursor']

        // remove timestamp & milliseconds
        if (paginationData instanceof Date) {
            paginationData = new Date(
                Date.UTC(
                    paginationData.getFullYear(),
                    paginationData.getMonth(),
                    paginationData.getDate(),
                    paginationData.getHours(),
                    paginationData.getMinutes(),
                    paginationData.getSeconds(),
                    paginationData.getMilliseconds()
                )
            )
        }

        const x = convertDataToCursor({
            [defaultColumn]: d[defaultColumn],
            [primaryColumn]: paginationData,
        })
        return {
            cursor: x,
            node: d,
        }
    })
}

const forwardPaginate = async ({
    scope,
    pageSize,
    defaultColumn,
    primaryColumn,
    cursorData,
}: IPaginationOptions) => {
    const seekPageSize = pageSize + 1 //end cursor will point to this record

    scope.take(seekPageSize)
    const data = await scope.getMany()
    const hasPreviousPage = cursorData ? true : false
    const hasNextPage = data.length > pageSize ? true : false
    let edges = getEdges(data, defaultColumn, primaryColumn)
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
    defaultColumn,
    primaryColumn,
}: IPaginationOptions) => {
    // we try to get items one more than the page size
    const seekPageSize = pageSize + 1 //start cursor will point to this record

    scope.take(seekPageSize)
    const data = await scope.getMany()
    data.reverse()

    const hasPreviousPage = data.length > pageSize ? true : false

    const hasNextPage = cursorData ? true : false

    let edges = getEdges(data, defaultColumn, primaryColumn)
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

    const { order, primaryColumn } = addOrderByClause(scope, sort, direction)

    if (cursorData) {
        const directionOperator = order === 'ASC' ? '>' : '<'
        if (primaryColumn) {
            // https://stackoverflow.com/questions/38017054/mysql-cursor-based-pagination-with-multiple-columns
            // https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON
            scope.andWhere(
                `(${primaryColumn}, ${scope.alias}.${sort.defaultField}) ${directionOperator} (:primaryColumn, :defaultColumn)`,
                {
                    primaryColumn: cursorData[primaryColumn],
                    defaultColumn: cursorData[sort.defaultField],
                }
            )
            scope.offset(0)
        } else {
            scope.andWhere(
                `${scope.alias}.${sort.defaultField} ${directionOperator} :defaultColumn`,
                {
                    defaultColumn: cursorData[sort.defaultField],
                }
            )
        }
    }

    const { edges, pageInfo } =
        direction && direction === SEEK_BACKWARD
            ? await backwardPaginate({
                  scope,
                  pageSize,
                  cursorData,
                  defaultColumn: sort.defaultField,
                  primaryColumn,
              })
            : await forwardPaginate({
                  scope,
                  pageSize,
                  cursorData,
                  defaultColumn: sort.defaultField,
                  primaryColumn,
              })
    return {
        totalCount,
        edges,
        pageInfo,
    }
}
