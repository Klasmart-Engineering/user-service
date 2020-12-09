import { SchoolMembership } from "../../../src/entities/schoolMembership";
import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";
import { JoeAuthToken } from "../testConfig";

const ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $organization_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                addRole(role_id: $role_id) {
                    role_id
                    role_name
                }
            }
        }
    }
`;

const GET_SCHOOL_MEMBERSHIPS = `
    query myQuery(
            $user_id: ID!
            $organization_id: ID!
            $permission_name: String) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                schoolMemberships(permission_name: $permission_name) {
                    school_id
                    school {
                        school_name
                    }
                }
            }
        }
    }
`;

export async function addRoleToOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string, roleId: string) {
    const { mutate } = testClient;
    
    const operation = () => mutate({
        mutation: ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP,
        variables: { user_id: userId, organization_id: organizationId, role_id: roleId },
        headers: { authorization: JoeAuthToken },
    });

    const res = await gqlTry(operation);
}

export async function getSchoolMembershipsForOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string, permission_name?: string) {
    const { mutate } = testClient;   
    
    if (permission_name !== undefined){    
        const operation = () => mutate({
            mutation: GET_SCHOOL_MEMBERSHIPS,
            variables: { user_id: userId, organization_id: organizationId, permission_name: permission_name },
            headers: { authorization: JoeAuthToken },
        });
        const res = await gqlTry(operation);
        return res.data?.user.membership.schoolMemberships as SchoolMembership[];
    }
    else{
        const operation = () => mutate({
            mutation: GET_SCHOOL_MEMBERSHIPS,
            variables: { user_id: userId, organization_id: organizationId},
            headers: { authorization: JoeAuthToken },
        });    
        const res = await gqlTry(operation);
        return res.data?.user.membership.schoolMemberships as SchoolMembership[];
    }
}

