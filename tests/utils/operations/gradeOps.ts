import { Headers } from 'node-mocks-http'
import { gql } from 'apollo-server-core'
import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const DELETE_GRADE = `
    mutation deleteGrade($id: ID!) {
        grade(id: $id) {
            delete
        }
    }
`

export async function deleteGrade(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_GRADE,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlBool = res.data?.grade?.delete as boolean
    return gqlBool
}

export const DELETE_GRADES = gql`
    mutation DeleteGrades($input: [DeleteGradeInput!]!) {
        deleteGrades(input: $input) {
            grades {
                id
                name
                status
                system
            }
        }
    }
`
