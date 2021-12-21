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
`

export const organization =`
    mutation organization($organization_id: ID!, $school_name: String, $shortcode: String) {
        organization(organization_id: $organization_id) {
            createSchool(school_name: $school_name, shortcode: $shortcode) {
                school_id
            }
        }
    }
`;

// Query for getSchoolsFilterList used in the Schedule section
export const getSchoolsFilterList =`
    query getSchoolsFilterList(
        $filter: SchoolFilter
        $direction: ConnectionDirection!
        $directionArgs: ConnectionsDirectionArgs
    ) {
        schoolsConnection(
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
            }
        }
    }
`;

// Query for meMemership 1 used in the Schedule section
export const meMembership =`
    query meMembership { 
        me {
            membership(organization_id: "360b46fe-3579-42d4-9a39-dc48726d033f") {
              create_schedule_page_501: checkAllowed(
                permission_name: "create_schedule_page_501"
              )
              schedule_search_582: checkAllowed(permission_name: "schedule_search_582")
            }
        }
    }
`;

// Query for meMemership 2 used in the Schedule section
export const meMembership2 =`
    query meMembership { 
        me {
            membership(organization_id: "360b46fe-3579-42d4-9a39-dc48726d033f") {
                attend_live_class_as_a_student_187: checkAllowed
                (permission_name: "attend_live_class_as_a_student_187")
                view_my_calendar_510: checkAllowed
                (permission_name: "view_my_calendar_510")
                create_schedule_page_501: checkAllowed
                (permission_name: "create_schedule_page_501")
            }
        }
    }
`;

// Query for meMemership 4 used in the Schedule section
export const meMembership3 =`
    query meMembership { 
        me {
                membership(organization_id: "360b46fe-3579-42d4-9a39-dc48726d033f")
                {
                    attend_live_class_as_a_student_187: checkAllowed
                    (permission_name: "attend_live_class_as_a_student_187")
                    view_my_calendar_510: checkAllowed
                    (permission_name: "view_my_calendar_510")
                    create_schedule_page_501: checkAllowed
                    (permission_name: "create_schedule_page_501")
                }
            }
        }
`;

// Query for meMemership 4 used in the Schedule section
export const meMembership4 =`
    query meMembership { 
        me {
                membership(organization_id: "360b46fe-3579-42d4-9a39-dc48726d033f")
                {
                    create_event_520: checkAllowed
                    (permission_name: "create_event_520")
                    create_my_schools_schedule_events_522: checkAllowed
                    (permission_name: "create_my_schools_schedule_events_522")
                    create_my_schedule_events_521: checkAllowed
                    (permission_name: "create_my_schedule_events_521")
                    attend_live_class_as_a_student_187: checkAllowed
                    (permission_name: "attend_live_class_as_a_student_187")
                    view_subjects_20115: checkAllowed
                    (permission_name: "view_subjects_20115")
                }
            }
        }
`;