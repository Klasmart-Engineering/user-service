import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'
import { Headers } from 'node-mocks-http'

const NON_EXISTING_QUERY = `
    query NonExistingQuery {
        nonExistingQuery {
            notAnId
            notAName
        }
    }
`

export async function nonExistingQuery(
    testClient: ApolloServerTestClient,
    headers?: Headers
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: NON_EXISTING_QUERY,
            headers: headers,
        })

    const res = await gqlTry(operation, true)
    return res
}
