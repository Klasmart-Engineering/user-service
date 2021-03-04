import { Headers } from 'node-mocks-http';

import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

const DELETE_SUBJECT = `
    mutation deleteSubject($id: ID!) {
        subject(id: $id) {
            delete
        }
    }
`;

export async function deleteSubject( testClient: ApolloServerTestClient, id: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_SUBJECT,
        variables: { id: id },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlBool = res.data?.subject?.delete as boolean;
    return gqlBool;
}

