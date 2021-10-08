import {
    addOrderByClause,
    ISortingConfig,
    ISortField,
    SortOrder,
} from './sorting'
import { SelectQueryBuilder, BaseEntity, Brackets } from 'typeorm'
import { IEntityFilter } from './filtering'

const DEFAULT_PAGE_SIZE = 50
const SEEK_BACKWARD = 'BACKWARD'

export type Direction = 'FORWARD' | 'BACKWARD'

export interface IPaginateData {
    direction: Direction
    directionArgs?: directionArgs
    scope: SelectQueryBuilder<unknown>
    sort: ISortingConfig
    includeTotalCount: boolean
}

interface IPaginationOptions {
    scope: SelectQueryBuilder<unknown>
    pageSize: number
    cursorData: unknown
    defaultColumn: string
    primaryColumns?: string[]
    totalCount?: number
}

export interface IPaginationArgs<Entity extends BaseEntity> {
    direction: Direction
    directionArgs: directionArgs
    scope: SelectQueryBuilder<Entity>
    filter?: IEntityFilter
    sort?: ISortField
}

interface IQueryParams {
    [key: string]: string | number | boolean
}

export interface IEdge<N = unknown> {
    cursor: string
    node: N
}

export interface IPaginatedResponse<T = unknown> {
    totalCount?: number
    pageInfo: {
        startCursor: string
        endCursor: string
        hasNextPage: boolean
        hasPreviousPage: boolean
    }
    edges: IEdge<T>[]
}

interface directionArgs {
    count: number
    cursor?: string
}

export const convertDataToCursor = (data: Record<string, unknown>) => {
    return Buffer.from(JSON.stringify(data)).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return JSON.parse(Buffer.from(cursor, 'base64').toString())
}

const getEdges = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    defaultColumn: string,
    primaryColumns?: string[]
) => {
    return data.map((d) => {
        const cursorData = {
            [defaultColumn]: d[defaultColumn],
        }

        if (primaryColumns?.length) {
            primaryColumns.forEach((primaryColumn) => {
                cursorData[primaryColumn] = d[primaryColumn]
            })
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
    primaryColumns,
    cursorData,
    totalCount,
}: IPaginationOptions) => {
    const seekPageSize = pageSize + 1 //end cursor will point to this record

    scope.take(seekPageSize)
    const data = await scope.getMany()
    const hasPreviousPage = cursorData ? true : false
    const hasNextPage = data.length > pageSize ? true : false
    let edges = getEdges(data, defaultColumn, primaryColumns)
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
    primaryColumns,
    totalCount,
}: IPaginationOptions) => {
    // we try to get items one more than the page size
    let newPageSize = pageSize
    // this is to make the first page going backwards look like offset pagination
    if (!cursorData) {
        if (totalCount === undefined) {
            totalCount = await scope.getCount()
        }

        newPageSize = totalCount % pageSize

        if (newPageSize === 0) {
            newPageSize = pageSize
        }
    }
    const seekPageSize = newPageSize + 1 //start cursor will point to this record

    scope.take(seekPageSize)
    const data = await scope.getMany()
    data.reverse()

    const hasPreviousPage = data.length > newPageSize ? true : false

    const hasNextPage = cursorData ? true : false

    let edges = getEdges(data, defaultColumn, primaryColumns)
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

export const getPaginationQuery = async ({
    direction,
    directionArgs,
    scope,
    sort,
    includeTotalCount,
}: IPaginateData) => {
    const pageSize = directionArgs?.count
        ? directionArgs.count
        : DEFAULT_PAGE_SIZE

    const cursorData = directionArgs?.cursor
        ? getDataFromCursor(directionArgs.cursor)
        : null

    const totalCount = includeTotalCount ? await scope.getCount() : undefined

    const { order, primaryColumns, primaryKeyOrder } = addOrderByClause(
        scope,
        direction,
        sort
    )

    if (cursorData) {
        const directionOperator = order === SortOrder.ASC ? '>' : '<'
        if (primaryColumns.length) {
            const pKeydirectionOperator =
                primaryKeyOrder === SortOrder.ASC ? '>' : '<'

            const queryColumns: string[] = []
            const queryValues: string[] = []
            const queryParams: IQueryParams = {}

            primaryColumns.forEach((primaryColumn, index) => {
                const paramName = `primaryColumn${index + 1}`
                queryColumns.push(`${scope.alias}.${primaryColumn}`)
                queryValues.push(`:${paramName}`)
                queryParams[paramName] = cursorData[primaryColumn]
            })
            const queryColumnsString = queryColumns.join(', ')
            const queryValuesString = queryValues.join(', ')
            scope.andWhere(
                new Brackets((qa) => {
                    qa.where(
                        `(${queryColumnsString}) ${directionOperator} (${queryValuesString})`,
                        {
                            ...queryParams,
                        }
                    ).orWhere(
                        new Brackets((qb) => {
                            qb.where(
                                `(${queryColumnsString}) = (${queryValuesString})`,
                                {
                                    ...queryParams,
                                }
                            ).andWhere(
                                `${scope.alias}.${sort.primaryKey} ${pKeydirectionOperator} :defaultColumn`,
                                {
                                    defaultColumn: cursorData[sort.primaryKey],
                                }
                            )
                        })
                    )
                })
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

    scope.take(pageSize)
    return scope
}

export const paginateData = async <T = unknown>({
    direction,
    directionArgs,
    scope,
    sort,
    includeTotalCount,
}: IPaginateData): Promise<IPaginatedResponse<T>> => {
    const pageSize = directionArgs?.count
        ? directionArgs.count
        : DEFAULT_PAGE_SIZE

    const cursorData = directionArgs?.cursor
        ? getDataFromCursor(directionArgs.cursor)
        : null

    const totalCount = includeTotalCount ? await scope.getCount() : undefined

    const { order, primaryColumns, primaryKeyOrder } = addOrderByClause(
        scope,
        direction,
        sort
    )

    if (cursorData) {
        const directionOperator = order === SortOrder.ASC ? '>' : '<'
        if (primaryColumns.length) {
            const pKeydirectionOperator =
                primaryKeyOrder === SortOrder.ASC ? '>' : '<'

            const queryColumns: string[] = []
            const queryValues: string[] = []
            const queryParams: IQueryParams = {}

            primaryColumns.forEach((primaryColumn, index) => {
                const paramName = `primaryColumn${index + 1}`
                queryColumns.push(`${scope.alias}.${primaryColumn}`)
                queryValues.push(`:${paramName}`)
                queryParams[paramName] = cursorData[primaryColumn]
            })
            const queryColumnsString = queryColumns.join(', ')
            const queryValuesString = queryValues.join(', ')
            scope.andWhere(
                new Brackets((qa) => {
                    qa.where(
                        `(${queryColumnsString}) ${directionOperator} (${queryValuesString})`,
                        {
                            ...queryParams,
                        }
                    ).orWhere(
                        new Brackets((qb) => {
                            qb.where(
                                `(${queryColumnsString}) = (${queryValuesString})`,
                                {
                                    ...queryParams,
                                }
                            ).andWhere(
                                `${scope.alias}.${sort.primaryKey} ${pKeydirectionOperator} :defaultColumn`,
                                {
                                    defaultColumn: cursorData[sort.primaryKey],
                                }
                            )
                        })
                    )
                })
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
                  primaryColumns,
                  totalCount,
              })
            : await forwardPaginate({
                  scope,
                  pageSize,
                  cursorData,
                  defaultColumn: sort.primaryKey,
                  primaryColumns,
                  totalCount,
              })

    return {
        totalCount,
        edges,
        pageInfo,
    }
}
