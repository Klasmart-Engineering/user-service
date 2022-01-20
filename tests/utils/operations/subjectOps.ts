import { Headers } from 'node-mocks-http'

import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

import { Subject } from '../../../src/entities/subject'
import { gql } from 'graphql-tag'

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
`

export const DELETE_SUBJECT = `
    mutation deleteSubject($id: ID!) {
        subject(id: $id) {
            delete
        }
    }
`

const SUBJECTS_MUTATION_OUTPUT = `
    subjects {
        id
        name
        status
        system
        categoriesConnection {
            edges {
              node {
                id
              }
            }
          }
    }
`

export const CREATE_SUBJECTS = gql`
    mutation CreateSubjects($input: [CreateSubjectInput!]!) {
        createSubjects(input: $input) {
            ${SUBJECTS_MUTATION_OUTPUT}
        }
    }
`

export async function deleteSubject(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_SUBJECT,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlBool = res.data?.subject?.delete as boolean
    return gqlBool
}

export async function describeSubject(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: DESCRIBE_SUBJECT,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubject = res.data?.subject as Subject

    return gqlSubject
}
