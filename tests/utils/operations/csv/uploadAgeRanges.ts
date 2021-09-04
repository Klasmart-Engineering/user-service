import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'

const UPLOAD_AGE_RANGES_MUTATION = `
    mutation UploadAgeRangesFromCSV($file: Upload!) {
        uploadAgeRangesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const UPLOAD_AGE_RANGES_QUERY = `
    query UploadAgeRangesFromCSV($file: Upload!) {
        uploadAgeRangesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export async function uploadAgeRanges(
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
            mutation: UPLOAD_AGE_RANGES_MUTATION,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadAgeRangesFromCSV
}

export async function queryUploadAgeRanges(
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
            query: UPLOAD_AGE_RANGES_QUERY,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadAgeRangesFromCSV
}
