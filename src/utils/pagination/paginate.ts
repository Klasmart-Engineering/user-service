import {
    addOrderByClause,
    ISortingConfig,
    ISortField,
    SortOrder,
} from './sorting'
import { SelectQueryBuilder, BaseEntity, Brackets } from 'typeorm'
import { IEntityFilter } from './filtering'
import { GraphQLResolveInfo } from 'graphql'
import { findTotalCountInPaginationEndpoints } from '../graphql'

const DEFAULT_PAGE_SIZE = 50

export type Direction = 'FORWARD' | 'BACKWARD'

export interface IPaginateData {
    direction: Direction
    directionArgs?: IDirectionArgs
    scope: SelectQueryBuilder<unknown>
    sort: ISortingConfig
    includeTotalCount: boolean
}

export interface IPaginationArgs<Entity extends BaseEntity> {
    direction: Direction
    directionArgs: IDirectionArgs
    scope: SelectQueryBuilder<Entity>
    filter?: IEntityFilter
    sort?: ISortField
}

export interface IChildPaginationArgs<Entity extends BaseEntity> {
    direction?: Direction
    count?: number
    cursor?: string
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

interface IDirectionArgs {
    count?: number
    cursor?: string
}

export const convertDataToCursor = (data: Record<string, unknown>) => {
    return Buffer.from(JSON.stringify(data)).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return JSON.parse(Buffer.from(cursor, 'base64').toString())
}

export function shouldIncludeTotalCount(
    info: GraphQLResolveInfo,
    direction: Direction
) {
    return direction === 'BACKWARD' || findTotalCountInPaginationEndpoints(info)
}

export const getEdges = (
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

export const adjustPageSize = (
    pageSize: number,
    cursorData: unknown,
    totalCount?: number,
    direction: Direction = 'FORWARD'
) => {
    if (direction === 'FORWARD') {
        return pageSize
    } else if (totalCount === undefined) {
        return pageSize
    }

    let newPageSize = pageSize
    // this is to make the first page going backwards look like offset pagination
    if (!cursorData) {
        newPageSize = totalCount % pageSize

        if (newPageSize === 0) {
            newPageSize = pageSize
        }
    }

    return newPageSize
}

export const getPageInfoAndEdges = <T = unknown>(
    data: T[],
    pageSize: number,
    defaultColumn: string,
    primaryColumns: string[],
    cursorData?: unknown,
    totalCount?: number,
    direction: Direction = 'FORWARD'
) => {
    const pageInfo = {
        startCursor: '',
        endCursor: '',
        hasNextPage: false,
        hasPreviousPage: false,
    }

    const adjustedPageSize = adjustPageSize(
        pageSize,
        cursorData,
        totalCount,
        direction
    )

    const seekPageSize = adjustedPageSize + 1

    let edges: IEdge<T>[] = []

    if (direction === 'FORWARD') {
        edges = getEdges(data, defaultColumn, primaryColumns)
        pageInfo.hasPreviousPage = cursorData ? true : false
        pageInfo.hasNextPage = data.length > adjustedPageSize ? true : false

        pageInfo.startCursor = edges.length > 0 ? edges[0].cursor : ''
        pageInfo.endCursor =
            edges.length > 0
                ? edges.length < seekPageSize
                    ? edges[edges.length - 1].cursor
                    : edges[adjustedPageSize - 1].cursor
                : ''
        edges = edges.slice(0, pageSize)
    } else {
        data.reverse()
        edges = getEdges(data, defaultColumn, primaryColumns)

        pageInfo.hasPreviousPage = data.length > adjustedPageSize ? true : false
        pageInfo.hasNextPage = cursorData ? true : false

        edges = edges.length === seekPageSize ? edges.slice(1) : edges

        pageInfo.startCursor = edges.length > 0 ? edges[0].cursor : ''
        pageInfo.endCursor =
            edges.length > 0 ? edges[edges.length - 1].cursor : ''
    }

    return { edges, pageInfo }
}

export const getPaginationQuery = async ({
    direction,
    directionArgs,
    scope,
    sort,
}: IPaginateData) => {
    const pageSize = directionArgs?.count
        ? directionArgs.count
        : DEFAULT_PAGE_SIZE

    const cursorData = directionArgs?.cursor
        ? getDataFromCursor(directionArgs.cursor)
        : null

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

    return { scope, primaryColumns, pageSize, cursorData }
}

export const paginateData = async <T = unknown>({
    direction,
    directionArgs,
    scope,
    sort,
    includeTotalCount,
}: IPaginateData): Promise<IPaginatedResponse<T>> => {
    const { pageSize, cursorData, primaryColumns } = await getPaginationQuery({
        direction,
        directionArgs,
        scope,
        sort,
        includeTotalCount,
    })

    let adjustedPageSize = pageSize
    let totalCount
    if (direction === 'BACKWARD' || includeTotalCount) {
        totalCount = await scope.getCount()
        adjustedPageSize = adjustPageSize(
            pageSize,
            cursorData,
            totalCount,
            direction
        )
    }

    const seekPageSize = adjustedPageSize + 1
    scope.take(seekPageSize)

    const data = (await scope.getMany()) as T[]

    const { edges, pageInfo } = getPageInfoAndEdges<T>(
        data,
        pageSize,
        sort.primaryKey,
        primaryColumns,
        undefined,
        cursorData,
        direction
    )

    return {
        totalCount,
        edges,
        pageInfo,
    }
}
