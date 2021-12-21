export const getClassFilterList = `
query getClassFilterList(
    $filter: ClassFilter
    $direction: ConnectionDirection!
    $directionArgs: ConnectionsDirectionArgs
) {
    classesConnection(
        filter: $filter
        direction: $direction
        directionArgs: $directionArgs
    ) {
        totalCount
        edges {
            cursor
            node {
                id
                name
            }
        }
        pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
        }
    }
}
`;