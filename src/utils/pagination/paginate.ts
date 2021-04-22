const DEFAULT_PAGE_SIZE = 50
const SEEK_BACKWARD = 'BACKWARD'

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

const getEdges = (data:any, cursorColumn: string) => {
    return data.map((d:any) => ({
        cursor: convertDataToCursor(d[cursorColumn]),
        node: d
    }))
}

const forwardPaginate = async ({scope, pageSize, cursorColumn, cursorData}:any) => {
    const seekPageSize = pageSize + 1 //end cursor will point to this record
    if(cursorData) {
        scope.andWhere(`${cursorColumn} > :cursorData`, { cursorData })
    }
    scope
        .orderBy(cursorColumn, 'ASC')
        .limit(seekPageSize)

    const data = await scope.getMany();

    const hasPreviousPage = (cursorData)?true:false
    const hasNextPage = (data.length>pageSize)?true: false

    let edges = getEdges(data, cursorColumn);
    const startCursor = edges[0].cursor;
    const endCursor = (edges.length < seekPageSize) ? edges[edges.length-1].cursor: edges[pageSize-1].cursor;
    edges = edges.slice(0, pageSize);
    
    const pageInfo = {
        startCursor,
        endCursor,
        hasNextPage,
        hasPreviousPage
    }
    return { edges, pageInfo}
}

const backwardPaginate = async ({scope, pageSize, totalCount, cursorColumn, cursorData}:any)  => {
    // we try to get items one more than the page size
    const seekPageSize = pageSize + 1 //start cursor will point to this record
    let data
    let hasPreviousPage
    if(cursorData) {
        scope
            .andWhere(`${cursorColumn} < :cursorData`, { cursorData })
            .orderBy(cursorColumn, 'DESC')
            .limit(seekPageSize)
        data = await scope.getMany();
        data.reverse()
        hasPreviousPage = (data.length > pageSize)?true: false

    } else {
        const skipValue = ((Math.ceil(totalCount/pageSize)*pageSize)-pageSize)
        scope.orderBy(cursorColumn, 'ASC').skip(skipValue)
        data = await scope.getMany();
        hasPreviousPage = (data.length < totalCount)?true: false
    }

    const hasNextPage = (cursorData)?true:false

    let edges = getEdges(data, cursorColumn);
    edges = (cursorData && edges.length === seekPageSize) ? edges.slice(1): edges;

    const startCursor = edges[0].cursor;
    const endCursor = edges[edges.length-1].cursor;

    const pageInfo = {
        startCursor,
        endCursor,
        hasNextPage,
        hasPreviousPage
    }
    return { edges, pageInfo}
}

export const paginateData = async ({direction, directionArgs, scope, cursorColumn}:any) => {
    const pageSize = (directionArgs?.count) ? directionArgs.count : DEFAULT_PAGE_SIZE;
    const cursorData = (directionArgs?.cursor) ? getDataFromCursor(directionArgs.cursor): null;
    const totalCount = await scope.getCount();

    const { edges, pageInfo } = (direction && direction === SEEK_BACKWARD) ? 
        await backwardPaginate({scope, totalCount, pageSize, cursorColumn, cursorData}) : 
        await forwardPaginate({scope, pageSize, cursorColumn, cursorData})
    return {
        totalCount,
        edges,
        pageInfo
    }
}
