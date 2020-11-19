import { ApolloServerTestClient } from "../createTestClient";
import { expect } from "chai";
import { JoeAuthToken } from "../testConfig";

const DELETE_ROLE = `
    mutation myMutation(
            $role_id: ID!) {
        role(role_id: $role_id) {
            delete_role() {
            }
        }
    }
`;

const GRANT_PERMISSION = `
    mutation myMutation(
            $role_id: ID!
            $permission_name: String!) {
        role(role_id: $role_id) {
            grant(permission_name: $permission_name) {
                role_id
                permission_name
                allow
            }
        }
    }
`;

export async function grantPermission(testClient: ApolloServerTestClient, roleId: string, permissionName: string) {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: GRANT_PERMISSION,
        variables: { role_id: roleId, permission_name: permissionName },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
}

export async function deleteRole(testClient: ApolloServerTestClient, roleId: string) {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: DELETE_ROLE,
        variables: { role_id: roleId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    return true;
}