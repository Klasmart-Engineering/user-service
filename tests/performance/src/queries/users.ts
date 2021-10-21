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