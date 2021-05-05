import { Headers } from 'node-mocks-http';

import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

const DELETE_SUBCATEGORY = `
    mutation deleteSubcategory($id: ID!) {
        subcategory(id: $id) {
            delete
        }
    }
`;

export async function deleteSubcategory( testClient: ApolloServerTestClient, id: string, headers?: Headers, cookies?: any) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_SUBCATEGORY,
        variables: { id: id },
        headers: headers,
        cookies: cookies
    });

    const res = await gqlTry(operation);
    const gqlBool = res.data?.subcategory?.delete as boolean;
    return gqlBool;
}

