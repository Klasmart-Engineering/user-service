import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'

const UPLOAD_CLASSES_MUTATION = `
    mutation UploadClassesFromCSV($file: Upload!) {
        uploadClassesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const UPLOAD_CLASSES_QUERY = `
    query UploadClassesFromCSV($file: Upload!) {
        uploadClassesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export async function uploadClasses(
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
            mutation: UPLOAD_CLASSES_MUTATION,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadClassesFromCSV
}

export async function queryUploadClasses(
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
            query: UPLOAD_CLASSES_QUERY,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadClassesFromCSV
}
