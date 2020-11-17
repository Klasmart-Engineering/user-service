import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { AuthToken } from "../testConfig";

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

export async function addRoleToOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string, roleId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP,
        variables: { user_id: userId, organization_id: organizationId, role_id: roleId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
}