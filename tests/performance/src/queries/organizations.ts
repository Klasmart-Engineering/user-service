export const get_organization_memberships = `{ me {
    email
    memberships {
        organization_id
        user_id
        status
        organization {
            organization_id
            organization_name
            phone
            owner {
                email
            }
            status
            branding {
                iconImageURL
                primaryColor
            }
        }
        roles {
            role_id
            role_name
        }
    }
}
}`;

export const get_organization_roles = `{
    organization(organization_id: $organization_id) {
        roles {
            role_id
            role_name
            role_description
            system_role
            status
            permissions {
                permission_id
                permission_name
                permission_group
                permission_level
                permission_category
                permission_description
            }
        }
    }
}`;