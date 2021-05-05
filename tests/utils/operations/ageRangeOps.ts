import { Headers } from 'node-mocks-http';

import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

const DELETE_ROLE = `
    mutation deleteRole($id: ID!) {
        age_range(id: $id) {
            delete
        }
    }
`;

export async function deleteAgeRange( testClient: ApolloServerTestClient, id: string, headers?: Headers, cookies?: any) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_ROLE,
        variables: { id: id },
        headers: headers,
        cookies: cookies
    });

    const res = await gqlTry(operation);
    const gqlBool = res.data?.age_range?.delete as boolean;
    return gqlBool;
}
