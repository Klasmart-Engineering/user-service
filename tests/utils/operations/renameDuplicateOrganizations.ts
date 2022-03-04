import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const RENAME_DUPLICATE_ORGANIZATIONS_MUTATION = `
    mutation {
        renameDuplicateOrganizations
    }
`

const RENAME_DUPLICATE_ORGANIZATIONS_QUERY = `
    query {
        renameDuplicateOrganizations
    }
`

export async function renameDuplicateOrganizationsMutation(
    testClient: ApolloServerTestClient,
    token?: string
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: RENAME_DUPLICATE_ORGANIZATIONS_MUTATION,
            headers: { authorization: token },
        })

    const res = await gqlTry(operation)
    return res.data?.renameDuplicateOrganizations
}

export async function renameDuplicateOrganizationsQuery(
    testClient: ApolloServerTestClient
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: RENAME_DUPLICATE_ORGANIZATIONS_QUERY,
        })

    const res = await gqlTry(operation)
    return res.data?.renameDuplicateOrganizations
}
