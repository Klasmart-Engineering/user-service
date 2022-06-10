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

const AGE_RANGE_FIELDS = gql`
    fragment ageRangeFields on AgeRangeConnectionNode {
        id
        name
        status
        system
        lowValue
        lowValueUnit
        highValue
        highValueUnit
    }
`

export const CREATE_AGE_RANGES = gql`
    ${AGE_RANGE_FIELDS}

    mutation CreateAgeRanges($input: [CreateAgeRangeInput!]!) {
        createAgeRanges(input: $input) {
            ageRanges {
                ...ageRangeFields
            }
        }
    }
`

export const DELETE_AGE_RANGES = gql`
    ${AGE_RANGE_FIELDS}

    mutation DeleteAgeRanges($input: [DeleteAgeRangeInput!]!) {
        deleteAgeRanges(input: $input) {
            ageRanges {
                ...ageRangeFields
            }
        }
    }
`
