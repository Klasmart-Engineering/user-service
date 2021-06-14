import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const RENAME_DUPLICATE_GRADES_MUTATION = `
    mutation {
        renameDuplicateGrades
    }
`

const RENAME_DUPLICATE_GRADES_QUERY = `
    query {
        renameDuplicateGrades
    }
`

export async function renameDuplicateGradesMutation(
    testClient: ApolloServerTestClient,
    token?: string
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: RENAME_DUPLICATE_GRADES_MUTATION,
            headers: { authorization: token },
        })

    const res = await gqlTry(operation)
    return res.data?.renameDuplicateGrades
}

export async function renameDuplicateGradesQuery(
    testClient: ApolloServerTestClient
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: RENAME_DUPLICATE_GRADES_QUERY,
        })

    const res = await gqlTry(operation)
    return res.data?.renameDuplicateGrades
}
