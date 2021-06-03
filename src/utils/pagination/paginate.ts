const DEFAULT_PAGE_SIZE = 50
const SEEK_BACKWARD = 'BACKWARD'

interface directionArgs {
    count: number
    cursor?: string
}

const convertDataToCursor = (data: string) => {
    return Buffer.from(JSON.stringify(data)).toString('base64')
}

const getDataFromCursor = (cursor: string) => {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'))
}

const getEdges = (data: any, sortColumns: any) => {
    return data.map((d: any) => {
        const cursorObject: any = {}
        sortColumns.forEach((value: any, key: any) => {
            cursorObject[key] = d[key]
        })

        console.log('***cursorObject', cursorObject)
        const cursor = convertDataToCursor(cursorObject)
        console.log('***cursor', cursor)
        return {
            cursor: convertDataToCursor(cursorObject),
            node: d,
        }
    })
}

const forwardPaginate = async ({
    scope,
    pageSize,
    cursorTable,
    cursorData,
    sortColumns,
    order,
}: any) => {
    const seekPageSize = pageSize + 1 //end cursor will point to this record
    console.log('***seekPageSize', seekPageSize)
    let whereClause = ''
    let whereClauseValue = ''
    let orderColumns: String[] = []
    sortColumns.forEach((value: any, key: any) => {
        orderColumns.push(`${cursorTable}.${key}`)
        whereClause = `${whereClause}"${cursorTable}"."${key}",`
        whereClauseValue = `${whereClauseValue}${value}`
    })
    console.log('***sortColumns', sortColumns)

    // remove the trailing ","
    whereClause = whereClause.substr(0, whereClause.length - 1)
    console.log('***whereClause', whereClause)
    console.log('***whereClauseValue', whereClauseValue)
    // const column = `"${cursorTable}"."${cursorColumn}"`
    // if (cursorData) {
    //     scope.andWhere(`${column} > :cursorData`, { cursorData })
    // }
    // scope.orderBy({
    //     [`"${cursorTable}_${cursorColumn}"`]: 'ASC',
    // })
    console.log('***order', order)
    const comparator = order && order === 'ASC' ? '>' : '<'
    console.log('***comparator', comparator)
    if (cursorData) {
        scope.andWhere(
            `CONCAT(${whereClause}) ${comparator} :whereClauseValue`,
            {
                whereClauseValue,
            }
        )
    }
    for (const orderColumn of orderColumns) {
        scope.addOrderBy(orderColumn, order)
    }
    // scope.orderBy({
    //     [whereClause]: order,
    // })
    scope.take(seekPageSize)
    console.log('***sql', scope.getSql())

    const data = await scope.getMany()
    console.log('***data', data)
    const hasPreviousPage = cursorData ? true : false
    const hasNextPage = data.length > pageSize ? true : false
    let edges = getEdges(data, sortColumns)
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
    console.log('***edges', edges)
    return { edges, pageInfo }
}

const backwardPaginate = async ({
    scope,
    pageSize,
    cursorTable,
    cursorColumn,
    cursorData,
}: any) => {
    // we try to get items one more than the page size
    const seekPageSize = pageSize + 1 //start cursor will point to this record
    // const column = `"${cursorTable}"."${cursorColumn}"`

    // if (cursorData) {
    //     scope.andWhere(`${column} < :cursorData`, { cursorData })
    // }
    // scope.orderBy({
    //     [`"${cursorTable}_${cursorColumn}"`]: 'DESC',
    // })
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

const getSortByColumns = (sortBy: any, cursorData: any) => {
    const sortByMap = new Map()
    switch (sortBy.by) {
        case 'name':
            sortByMap.set(
                'given_name',
                cursorData ? cursorData.given_name : null
            )
            sortByMap.set(
                'family_name',
                cursorData ? cursorData.family_name : null
            )
            sortByMap.set('user_id', cursorData ? cursorData.user_id : null)
            return sortByMap
        default:
            sortByMap.set('user_id', cursorData ? cursorData.user_id : null)
            return sortByMap
    }
}

export const paginateData = async ({
    direction,
    directionArgs,
    scope,
    cursorTable,
    sortBy,
}: any) => {
    console.log('***sortby', sortBy)
    const pageSize = directionArgs?.count
        ? directionArgs.count
        : DEFAULT_PAGE_SIZE
    const cursorData = directionArgs?.cursor
        ? getDataFromCursor(directionArgs.cursor)
        : null
    const sortColumns = getSortByColumns(sortBy, cursorData)
    const order = sortBy.order
    console.log('***getSortColumns', sortColumns)
    const totalCount = await scope.getCount()
    const { edges, pageInfo } =
        direction && direction === SEEK_BACKWARD
            ? await backwardPaginate({
                  scope,
                  pageSize,
                  cursorTable,
                  cursorData,
                  sortColumns,
                  order,
              })
            : await forwardPaginate({
                  scope,
                  pageSize,
                  cursorTable,
                  cursorData,
                  sortColumns,
                  order,
              })
    return {
        totalCount,
        edges,
        pageInfo,
    }
}
