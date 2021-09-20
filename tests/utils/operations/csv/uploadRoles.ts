import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'

const UPLOAD_ROLES_MUTATION = `
    mutation UploadRolesFromCSV($file: Upload!) {
        uploadRolesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const UPLOAD_ROLES_QUERY = `
    query UploadRolesFromCSV($file: Upload!) {
        uploadRolesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export async function uploadRoles(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: UPLOAD_ROLES_MUTATION,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadRolesFromCSV
}

export async function queryUploadRoles(
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
            query: UPLOAD_ROLES_QUERY,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadRolesFromCSV
}
