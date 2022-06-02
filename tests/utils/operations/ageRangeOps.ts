import { gql } from 'apollo-server-core'
import faker from 'faker'
import { Headers } from 'node-mocks-http'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { UpdateAgeRangeInput } from '../../../src/types/graphQL/ageRange'

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

export function buildSingleUpdateAgeRangeInput(
    id: string,
    name?: string,
    lowValue?: number,
    lowValueUnit?: AgeRangeUnit,
    highValue?: number,
    highValueUnit?: AgeRangeUnit
): UpdateAgeRangeInput {
    const units = [AgeRangeUnit.MONTH, AgeRangeUnit.YEAR]
    return {
        id,
        name: name ?? faker.datatype.string(),
        lowValue: lowValue ?? faker.datatype.number(99),
        lowValueUnit: lowValueUnit ?? units[faker.datatype.number(1)],
        highValue: highValue ?? faker.datatype.number(99),
        highValueUnit: highValueUnit ?? units[faker.datatype.number(1)],
    }
}

export function buildUpdateAgeRangeInputArray(
    ids: string[]
): UpdateAgeRangeInput[] {
    return Array.from(ids, (id, i) => buildSingleUpdateAgeRangeInput(id))
}
