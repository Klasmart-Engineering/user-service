export const getPaginatedOrganizationSchools = `
    query getOrganizationSchools(
        $direction: ConnectionDirection!
        $count: PageSize
        $cursor: String
        $orderBy: [SchoolSortBy!]!
        $order: SortOrder!
        $filter: SchoolFilter
    ) {
        schoolsConnection(
            direction: $direction
            directionArgs: { count: $count, cursor: $cursor }
            sort: { field: $orderBy, order: $order }
            filter: $filter
        ) {
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
                    name
                    status
                    shortCode
                }
            }
        }
    }
`;