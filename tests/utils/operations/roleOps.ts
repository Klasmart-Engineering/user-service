import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";
import { gqlTry } from "../gqlTry";

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

    const operation = () => mutate({
        mutation: GRANT_PERMISSION,
        variables: { role_id: roleId, permission_name: permissionName },
        headers: { authorization: JoeAuthToken },
    });

    const res = await gqlTry(operation);
}

export async function deleteRole(testClient: ApolloServerTestClient, roleId: string) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_ROLE,
        variables: { role_id: roleId },
        headers: { authorization: JoeAuthToken },
    });

    const res = await gqlTry(operation);
    return true;
}