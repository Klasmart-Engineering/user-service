import { UserAccountCreate } from "../interfaces/users";

export const createUserQuery = (account: UserAccountCreate) => (`mutation organizationInviteUser {
    organization(organization_id: "${account.organization_id}") {
        inviteUser(
            email: "${account.email}"
            phone: "${account.phone}"
            given_name: "${account.given_name}"
            family_name: "${account.family_name}"
            organization_role_ids: ${JSON.stringify(account.organization_role_ids)}
            school_ids: ${JSON.stringify(account.school_ids)}
            school_role_ids: ${JSON.stringify(account.school_role_ids)}
            date_of_birth: "${account.date_of_birth}"
            alternate_email: "${account.alternate_email}"
            alternate_phone: "${account.alternate_phone}"
            gender: "${account.gender}"
            shortcode: "${account.shortcode}"
            ) {
                user {
                    user_id
                    gender
                    alternate_email
                    date_of_birth                  
                }
                membership {
                    roles {
                        role_id                     
                    }
                    shortcode                
                }
                schoolMemberships {
                    school_id
                    roles {
                        role_id                 
                    }              
                }           
            }     
        }
    }
`);

export const myUsersQuery = `query {
    my_users {
        user_id
        full_name
        given_name
        family_name
        email
        phone
        date_of_birth
        avatar
        username
    }
}`;

export const meQuery = `{ me {
    user_id
    user_name
    email
    given_name
  	memberships {
      organization_id
      roles {
        role_id
        role_name
        permissions {
          permission_id
        }
      }
    }
} }`;

export const editUserQuery = `
    mutation organizationEditMembership {
        organization(organization_id: $organization_id) {
            editMembership(
                user_id: $user_id
                email: $email
                phone: $phone
                given_name: $given_name
                family_name: $family_name
                organization_role_ids: $organization_role_ids
                school_ids: $school_ids
                school_role_ids: $school_role_ids
                date_of_birth: $date_of_birth
                alternate_email: $alternate_email
                alternate_phone: $alternate_phone
                gender: $gender
                shortcode: $shortcode
            ) {
                user {
                    user_id
                    gender
                    alternate_email
                    date_of_birth
                }
                membership {
                    roles {
                        role_id
                    }
                    shortcode
                }
                schoolMemberships {
                    school_id
                    roles {
                        role_id
                    }
                }
            }
        }
    }
`;

export const getOrganizationUserQuery = `
    query getOrganizationUser($userId: ID!, $organizationId: ID!) {
        user(user_id: $userId) {
            membership(organization_id: $organizationId) {
                shortcode
                user_id
                organization_id
                user {
                    given_name
                    family_name
                    email
                    gender
                    email
                    phone
                    date_of_birth
                    alternate_email
                    alternate_phone
                }
                roles {
                    role_id
                    role_name
                    status
                }
                schoolMemberships {
                    school_id
                    school {
                        school_name
                        status
                    }
                }
            }
        }
    }
`;

export const getUserQuery = `
    query user($user_id: ID!) {
        user(user_id: $user_id) {
        user_id
        user_name
        given_name
        family_name
        email
        phone
        avatar
        memberships {
            user_id
            organization_id
            join_timestamp
            roles {
            role_id
            role_name
            }
            organization {
            organization_id
            organization_name
            address1
            shortCode
            phone
            roles {
                role_id
                role_name
            }
            students {
                user_id
                user {
                user_id
                }
            }
            owner {
                user_id
                user_name
                email
            }
            }
        }
        my_organization {
            organization_id
            organization_name
            phone
        }
        }
    }
`;

export const userFields = `
    fragment UserFields on User {
        user_id
        full_name
        given_name
        family_name
        email
        phone
        date_of_birth
        avatar
        username
        alternate_phone
        membership(organization_id: $organization_id) {
            status
            roles {
                role_id
                role_name
                status
            }
        }
        subjectsTeaching {
            id
            name
        }
    }
`;

export const getClassRoster = `
    ${userFields}

    query class($class_id: ID!, $organization_id: ID!) {
        class(class_id: $class_id) {
            class_name
            students {
                ...UserFields
            }
            teachers {
                ...UserFields
            }
        }
    }
`;

export const roleSummaryNodeFields = `
    fragment RoleSummaryNodeFields on RoleSummaryNode {
        id
        organizationId
        schoolId
        name
        status
    }
`;

export const getPaginatedOrganizationUsers = `
    ${roleSummaryNodeFields}
    
    query getOrganizationUsers(
        $direction: ConnectionDirection!
            $count: PageSize
            $cursor: String
            $order: SortOrder!
            $orderBy: UserSortBy!
            $filter: UserFilter
        ) {
            usersConnection(
                direction: $direction
                directionArgs: { count: $count, cursor: $cursor }
                sort: { field: [$orderBy], order: $order }
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
                    givenName
                    familyName
                    avatar
                    status
                    organizations {
                        name
                        userStatus
                        joinDate
                    }
                    schools {
                        id
                        name
                        status
                    }
                    roles {
                        ...RoleSummaryNodeFields
                    }
                    contactInfo {
                        email
                        phone
                    }
                }
            }
        }
    }
`;

export const meQueryReq1 = `{ me {
    avatar
	email
	phone
	user_id
	username
	given_name
	family_name
    }
}`;

export const getUserNode = `query getUserNode($id: ID!, $organizationId: UUID!) {
    userNode(id: $id) {
        id
        givenName
        familyName
        gender
        dateOfBirth
        roles {
            id
            name
            organizationId
            schoolId
            status
        }
        contactInfo {
            email
            phone
        }
        organizationMembershipsConnection(count: 1, filter: { organizationId: { value: $organizationId, operator: eq }}) {
            edges {
                node {
                    userId
                    shortCode
                }
            }
        }
    }
}`;


export const meQueryOrganizationReq3 = `{ me {
        user_id
        full_name
        classesStudying {
            class_id
            class_name
            schools {
                school_id
                school_name
            }
            organization {
                organization_id
                organization_name
            }
        }
        classesTeaching {
            class_id
            class_name
            schools {
                school_id
                school_name
                __typename
            }
            organization {
                organization_id
                organization_name
            }
        }
    }
}`;


/* export const meQueryOrganizationReq5 = `{ me {
        membership {
            organization_id
            roles {
                permissions {
                    permission_id
                }
            }
        }
    }
}`; */

export const meQueryOrganizationReq5 = `query ($organizationId: ID!) {
    me { membership(organization_id: $organizationId) {
        organization_id
        roles {
          permissions {
            permission_id
          }
        }
      }
    }
}`


// Users in Plural
export const getMyUsers = ` { my_users {
            user_id
            full_name
            given_name
            family_name
            email
            phone
            date_of_birth
            avatar
            username
            memberships {
                status
            }
        }
    }
`;

// User in Singular
/* export const getMyUser = ` { myUser {
    node {
        id
        familyName
        givenName
        avatar
        contactInfo {
            email
            phone
        }
    }
}
}
`; */

// Updated on April 19, 2022
export const getMyUser = ` { myUser {
      profiles {
        id
        givenName
        familyName
        avatar
        contactInfo {
          email
          phone
          username
        }
      }
      node {
        id
        givenName
        familyName
        avatar
        contactInfo {
          email
          phone
          username
        }
        username
        organizationMembershipsConnection(direction: FORWARD) {
          edges {
            node {
              organization {
                id
                name
                branding {
                  primaryColor
                  iconImageURL
                }
                owners {
                  email
                }
                contactInfo {
                  phone
                }
              }
              rolesConnection(direction: FORWARD) {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;


export const meClassesStudying = ` { me {
        user_id
        full_name
        classesStudying {
            class_id
            class_name
            schools {
                school_id
                school_name
            }
            organization {
                organization_id
                organization_name
            }
        }
        classesTeaching {
            class_id
            class_name
            schools {
                school_id
                school_name
                __typename
            }
            organization {
                organization_id
                organization_name
            }
        }
    }
}
`;



export const contentsMe1 =  (orgId: string) => (`{ meMembership: me {
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
}}
`);

export const contentsMe2 = (orgId: string) => (`{ meMembership: me {
    membership(organization_id: "${orgId}") {
        published_content_page_204: checkAllowed(permission_name: "published_content_page_204")
        pending_content_page_203: checkAllowed(permission_name: "pending_content_page_203")
        unpublished_content_page_202: checkAllowed(permission_name: "unpublished_content_page_202")
        archived_content_page_205: checkAllowed(permission_name: "archived_content_page_205")
        create_asset_page_301: checkAllowed(permission_name: "create_asset_page_301")
    }
}}
`);
