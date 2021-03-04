import { Headers } from 'node-mocks-http';

import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

const DELETE_SUBCATEGORY = `
    mutation deleteCategory($id: ID!) {
        category(id: $id) {
            delete
        }
    }
`;

export async function deleteCategory( testClient: ApolloServerTestClient, id: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_SUBCATEGORY,
        variables: { id: id },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlBool = res.data?.category?.delete as boolean;
    return gqlBool;
}
