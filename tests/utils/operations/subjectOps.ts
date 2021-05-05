import { Headers } from 'node-mocks-http';

import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

import { Subject } from "../../../src/entities/subject";

const DESCRIBE_SUBJECT = `
    query describeSubject($id: ID!) {
        subject(id: $id) {
            name
            categories {
                id
            }
            subcategories {
                id
            }
            system
        }
    }
`;

const DELETE_SUBJECT = `
    mutation deleteSubject($id: ID!) {
        subject(id: $id) {
            delete
        }
    }
`;

export async function deleteSubject( testClient: ApolloServerTestClient, id: string, headers?: Headers, cookies?: any) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_SUBJECT,
        variables: { id: id },
        headers: headers,
        cookies: cookies
    });

    const res = await gqlTry(operation);
    const gqlBool = res.data?.subject?.delete as boolean;
    return gqlBool;
}

export async function describeSubject(testClient: ApolloServerTestClient, id: string, headers?: Headers, cookies?: any) {
    const { query } = testClient;

    const operation = () => query({
        query: DESCRIBE_SUBJECT,
        variables: { id: id },
        headers: headers,
        cookies: cookies
    });

    const res = await gqlTry(operation);
    const gqlSubject = res.data?.subject as Subject;

    return gqlSubject;
}
