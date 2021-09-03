import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'

const UPLOAD_CATEGORIES_MUTATION = `
    mutation UploadCategoriesFromCSV($file: Upload!) {
        uploadCategoriesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const UPLOAD_CATEGORIES_QUERY = `
    query UploadCategoriesFromCSV($file: Upload!) {
        uploadCategoriesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export async function uploadCategories(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string,
    authToken: string
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: UPLOAD_CATEGORIES_MUTATION,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadCategoriesFromCSV
}

export async function queryUploadCategories(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string,
    authToken: string
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { query } = testClient

    const operation = () =>
        query({
            query: UPLOAD_CATEGORIES_QUERY,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadCategoriesFromCSV
}
