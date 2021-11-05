export const getOrganizationRoles = `
    query getOrganizationRoles($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            roles {
                role_id
                role_name
                role_description
                system_role
                status
            }
        }
    }
`;
