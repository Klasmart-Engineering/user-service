export const getAgeRanges = `
    query getPaginatedAgeRanges(
        $count: PageSize
        $cursor: String
        $direction: ConnectionDirection!
        $orderBy: [AgeRangeSortBy!]!
        $order: SortOrder!
        $filter: AgeRangeFilter
    ){
        ageRangesConnection(
            direction: $direction
            directionArgs: { count: $count, cursor: $cursor }
            sort: { field: $orderBy, order: $order }
            filter: $filter
        ){
            totalCount
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
            edges {
                node {
                    id
                    lowValue
                    lowValueUnit
                    highValue
                    highValueUnit
                    system
                    name
                }
            }
        }
    }
`;