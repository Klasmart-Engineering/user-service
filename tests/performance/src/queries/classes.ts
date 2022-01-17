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

export const CREATE_CLASS = `
    mutation organization($organization_id: ID!, $class_name: String, $school_ids: [ID!]) {
        organization(organization_id: $organization_id) {
            createClass(class_name: $class_name) {
                class_id
                class_name
                editSchools(school_ids: $school_ids) {
                    school_id
                    school_name
                }
            }
        }
    }
`;
