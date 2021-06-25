import { addOrderByClause, ISortingConfig, ISortField } from './sorting'
import { SelectQueryBuilder, BaseEntity } from 'typeorm'
import { IEntityFilter } from './filtering'

const DEFAULT_PAGE_SIZE = 50
const SEEK_BACKWARD = 'BACKWARD'

export type Direction = 'FORWARD' | 'BACKWARD'

export interface IPaginateData {
    direction: Direction
    directionArgs?: directionArgs
    scope: SelectQueryBuilder<unknown>
    sort: ISortingConfig
}

interface IPaginationOptions {
    scope: SelectQueryBuilder<unknown>
    pageSize: number
    cursorData: unknown
    defaultColumn: string
    primaryColumn?: string
}

export interface IPaginationArgs<Entity extends BaseEntity> {
    direction: Direction
    directionArgs: directionArgs
    scope: SelectQueryBuilder<Entity>
    filter?: IEntityFilter
    sort?: ISortField
}

export interface IPaginatedResponse<T = unknown> {
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
    return Buffer.from(JSON.stringify(data)).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'))
}

const getEdges = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    defaultColumn: string,
    primaryColumn?: string
) => {
    return data.map((d) => {
        const cursorData = {
            [defaultColumn]: d[defaultColumn],
        }

        if (primaryColumn) {
            cursorData[primaryColumn] = d[primaryColumn]
        }

        return {
            cursor: convertDataToCursor(cursorData),
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

export const paginateData = async <T = unknown>({
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

    const { order, primaryColumn } = addOrderByClause(scope, direction, sort)

    if (cursorData) {
        const directionOperator = order === 'ASC' ? '>' : '<'
        if (primaryColumn) {
            scope.andWhere(
                `(${scope.alias}.${primaryColumn}, ${scope.alias}.${sort.primaryKey}) ${directionOperator} (:primaryColumn, :defaultColumn)`,
                {
                    primaryColumn: cursorData[primaryColumn],
                    defaultColumn: cursorData[sort.primaryKey],
                }
            )
            scope.offset(0)
        } else {
            scope.andWhere(
                `${scope.alias}.${sort.primaryKey} ${directionOperator} :defaultColumn`,
                {
                    defaultColumn: cursorData[sort.primaryKey],
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
                  defaultColumn: sort.primaryKey,
                  primaryColumn,
              })
            : await forwardPaginate({
                  scope,
                  pageSize,
                  cursorData,
                  defaultColumn: sort.primaryKey,
                  primaryColumn,
              })
    return {
        totalCount,
        edges,
        pageInfo,
    }
}
