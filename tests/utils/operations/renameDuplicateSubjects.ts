import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const RENAME_DUPLICATE_SUBJECTS_MUTATION = `
    mutation {
        renameDuplicateSubjects
    }
`

const RENAME_DUPLICATE_SUBJECTS_QUERY = `
    query {
        renameDuplicateSubjects
    }
`

export async function renameDuplicateSubjectsMutation(
    testClient: ApolloServerTestClient,
    token?: string
) {
    const { mutate } = testClient
    const operation = () =>
        mutate({
            mutation: RENAME_DUPLICATE_SUBJECTS_MUTATION,
            headers: { authorization: token },
        })

    const res = await gqlTry(operation)
    return res.data?.renameDuplicateSubjects
}

export async function renameDuplicateSubjectsQuery(
    testClient: ApolloServerTestClient
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: RENAME_DUPLICATE_SUBJECTS_QUERY,
        })

    const res = await gqlTry(operation)
    return res.data?.renameDuplicateSubjects
}
