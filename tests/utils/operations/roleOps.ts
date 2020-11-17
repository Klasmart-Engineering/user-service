import { ApolloServerTestClient } from "../createTestClient";
import { expect } from "chai";
import { Role } from "../../../src/entities/role";
import { AuthToken } from "../testConfig";

const DELETE_ROLE = `
    mutation myMutation(
            $role_id: ID!) {
        role(role_id: $role_id) {
            delete_role() {
            }
        }
    }
`;

export async function deleteRole(testClient: ApolloServerTestClient, roleId: string) {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: DELETE_ROLE,
        variables: { role_id: roleId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    return true;
}