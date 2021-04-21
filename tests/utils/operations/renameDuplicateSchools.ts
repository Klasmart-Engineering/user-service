import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";

const RENAME_DUPLICATE_SCHOOLS_MUTATION = `
    mutation {
        renameDuplicateSchools
    }
`;

const RENAME_DUPLICATE_SCHOOLS_QUERY = `
    query {
        renameDuplicateSchools
    }
`;

export async function renameDuplicateSchoolsMutation(
    testClient: ApolloServerTestClient,
    token?: string,
) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: RENAME_DUPLICATE_SCHOOLS_MUTATION,
        headers: { authorization: token },
    });

    const res = await gqlTry(operation);
    return res.data?.renameDuplicateSchools;
}

export async function renameDuplicateSchoolsQuery(
    testClient: ApolloServerTestClient,
) {
    const { query } = testClient;

    const operation = () => query({
        query: RENAME_DUPLICATE_SCHOOLS_QUERY,
    });

    const res = await gqlTry(operation);
    return res.data?.renameDuplicateOrganizations;
}