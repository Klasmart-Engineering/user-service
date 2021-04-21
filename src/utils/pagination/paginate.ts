const DEFAULT_PAGE_SIZE = 10
const SEEK_FORWARD = 'FORWARD'

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

export const paginateData = async (direction: string, directionArgs: directionArgs, scope: any, cursorColumn: string) => {
    let hasPreviousPage;
    let hasNextPage;
    let edges;
    let startCursor;
    let endCursor;
    const pageSize = (directionArgs?.count) ? directionArgs.count : DEFAULT_PAGE_SIZE;
    const cursorData = (directionArgs?.cursor) ? getDataFromCursor(directionArgs.cursor): null;
    const totalCount = await scope.getCount();

    //TODO: Travel backwards
    if(direction === SEEK_FORWARD) {
        // we try to get items one more than the page size
        const seekPageSize = pageSize + 1 //end cursor will point to this record
        if(cursorData) {
            scope
                .andWhere(`${cursorColumn} > :cursorData`, { cursorData })
        }
        scope
            .orderBy(cursorColumn, 'ASC')
            .limit(seekPageSize)
        hasPreviousPage = (directionArgs?.cursor)?true:false

        const data = await scope.getMany();
        hasNextPage = (data.length>pageSize)?true: false

        edges = getEdges(data, cursorColumn);
        startCursor = edges[0].cursor;
        endCursor = (edges.length < seekPageSize) ? edges[edges.length-1].cursor: edges[pageSize-1].cursor;
        edges = edges.slice(0, pageSize);
    }

    const pageInfo = {
        startCursor,
        endCursor,
        hasNextPage,
        hasPreviousPage
    }

    return {
        totalCount,
        edges,
        pageInfo
    }
    //TODO: Error handling
}
