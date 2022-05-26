import { gql } from 'apollo-server-core'
import { Headers } from 'node-mocks-http'

import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const DELETE_ROLE = `
    mutation deleteRole($id: ID!) {
        age_range(id: $id) {
            delete
        }
    }
`

export async function deleteAgeRange(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_ROLE,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlBool = res.data?.age_range?.delete as boolean
    return gqlBool
}

export const DELETE_AGE_RANGES = gql`
    mutation DeleteAgeRanges($input: [DeleteAgeRangeInput!]!) {
        deleteAgeRanges(input: $input) {
            ageRanges {
                id
                name
                status
                system
                lowValue
                lowValueUnit
                highValue
                highValueUnit
            }
        }
    }
`
