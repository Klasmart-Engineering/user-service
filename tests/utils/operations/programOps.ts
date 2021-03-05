import { Headers } from 'node-mocks-http';

import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

const DELETE_PROGRAM = `
    mutation deleteProgram($id: ID!) {
        program(id: $id) {
            delete
        }
    }
`;

export async function deleteProgram( testClient: ApolloServerTestClient, id: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_PROGRAM,
        variables: { id: id },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlBool = res.data?.program?.delete as boolean;
    return gqlBool;
}

