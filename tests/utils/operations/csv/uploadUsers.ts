import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'
import { Headers } from 'node-mocks-http'

const UPLOAD_USERS_MUTATION = `
    mutation UploadUsersFromCSV($file: Upload!, $isDryRun: Boolean) {
        uploadUsersFromCSV(file: $file, isDryRun: $isDryRun) {
            filename
            mimetype
            encoding
        }
    }
`

const UPLOAD_USERS_QUERY = `
    query UploadUsersFromCSV($file: Upload!) {
        uploadUsersFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export async function uploadUsers(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string,
    isDryRun = false,
    headers?: Headers
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
        isDryRun,
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: UPLOAD_USERS_MUTATION,
            variables,
            headers,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadUsersFromCSV
}

export async function queryUploadUsers(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { query } = testClient

    const operation = () =>
        query({
            query: UPLOAD_USERS_QUERY,
            variables,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadUsersFromCSV
}
