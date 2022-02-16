// Query for meMemership 1 used in the Schedule section
export const meMembershipForCMS = (orgId: string) => (`
    query meMembership { 
        me {
            membership(organization_id: "${orgId}") {
                create_content_page_201: checkAllowed(permission_name: "create_content_page_201")
                create_lesson_material_220: checkAllowed(permission_name: "create_lesson_material_220")
                create_lesson_plan_221: checkAllowed(permission_name: "create_lesson_plan_221")
                create_folder_289: checkAllowed(permission_name: "create_folder_289")
                published_content_page_204: checkAllowed(permission_name: "published_content_page_204")
                pending_content_page_203: checkAllowed(permission_name: "pending_content_page_203")
                unpublished_content_page_202: checkAllowed(permission_name: "unpublished_content_page_202")
                archived_content_page_205: checkAllowed(permission_name: "archived_content_page_205")
                create_asset_page_301: checkAllowed(permission_name: "create_asset_page_301")
                view_my_published_214: checkAllowed(permission_name: "view_my_published_214")
                create_folder_289: checkAllowed(permission_name: "create_folder_289")
                delete_asset_340: checkAllowed(permission_name: "delete_asset_340")
                archive_published_content_273: checkAllowed(permission_name: "archive_published_content_273")
                republish_archived_content_274: checkAllowed(permission_name: "republish_archived_content_274")
                delete_archived_content_275: checkAllowed(permission_name: "delete_archived_content_275")
                approve_pending_content_271: checkAllowed(permission_name: "approve_pending_content_271")
                reject_pending_content_272: checkAllowed(permission_name: "reject_pending_content_272")
                create_folder_289: checkAllowed(permission_name: "create_folder_289")
                publish_featured_content_for_all_hub_79000: checkAllowed(permission_name: "publish_featured_content_for_all_hub_79000")
                publish_featured_content_for_all_orgs_79002: checkAllowed(permission_name: "publish_featured_content_for_all_orgs_79002")
                publish_featured_content_for_specific_orgs_79001: checkAllowed(permission_name: "publish_featured_content_for_specific_orgs_79001")
            }
        }
    }
`);

// Query for meMemership 1 used in the Schedule section
export const meMembershipForCMS2 = (orgId: string) => (`
    query meMembership { 
        me {
                membership(organization_id: "${orgId}") {
                published_content_page_204: checkAllowed(permission_name: "published_content_page_204")
                pending_content_page_203: checkAllowed(permission_name: "pending_content_page_203")
                unpublished_content_page_202: checkAllowed(permission_name: "unpublished_content_page_202")
                archived_content_page_205: checkAllowed(permission_name: "archived_content_page_205")
                create_asset_page_301: checkAllowed(permission_name: "create_asset_page_301")
            }
        }
    }
`);

// Query for meMemership 1 used in the Schedule section
export const getProgramsAndSubjects =`{
    query getProgramsAndSubjects(
        $count: PageSize!
        $cursor: String!
        $filter: ProgramFilter!
    ) {
        programsConnection(
            filter: $filter
            directionArgs: { count: $count, cursor: $cursor }
            direction: FORWARD
        ) {
            totalCount
            pageInfo {
                hasNextPage
                endCursor
            }
            edges {
                node {
                    id
                    name
                    status
                    system
                    ageRanges {
                        id
                        name
                        status
                        system
                    }
                    grades {
                        id
                        name
                        status
                        system
                    }
                    subjects {
                        id
                        name
                        status
                        system
                    }
                }
            }
        }
    }
}
`;

// Query for meMemership 1 used in the Schedule section
export const meMembershipForPlan =`
    query meMembership { 
        me {
            membership(organization_id: "360b46fe-3579-42d4-9a39-dc48726d033f") {
                edit_org_published_content_235: checkAllowed(permission_name: "edit_org_published_content_235"
)
                create_asset_320: checkAllowed(permission_name: "create_asset_320")
                edit_lesson_material_metadata_and_content_236: checkAllowed(permission_name: "edit_lesson_material_metadata_and_content_236"
                )
                edit_lesson_plan_content_238: checkAllowed(permission_name: "edit_lesson_plan_content_238"
                )
                edit_lesson_plan_metadata_237: checkAllowed(permission_name: "edit_lesson_plan_metadata_237"
                )
            }
        }
    }
`;