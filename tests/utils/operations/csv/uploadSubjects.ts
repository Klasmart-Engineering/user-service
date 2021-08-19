import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'

const UPLOAD_SUBJECTS_MUTATION = `
    mutation UploadSubjectsFromCSV($file: Upload!){
        uploadSubjectsFromCSV(file: $file) {
                filename
                mimetype
                encoding
        }
    }
`

const UPLOAD_SUBJECTS_QUERY = `
    query UploadSubjectsFromCSV($file: Upload!){
        uploadSubjectsFromCSV(file: $file) {
                filename
                mimetype
                encoding
        }
    }
`

export async function uploadSubjects(
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
            mutation: UPLOAD_SUBJECTS_MUTATION,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadSubjectsFromCSV
}

export async function queryUploadSubjects(
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
            query: UPLOAD_SUBJECTS_QUERY,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadSubjectsFromCSV
}
