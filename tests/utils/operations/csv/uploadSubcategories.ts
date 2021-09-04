import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../../createTestClient'
import { gqlTry } from '../../gqlTry'
import { fileMockInput } from '../modelOps'

const UPLOAD_SUBCATEGORIES_MUTATION = `
    mutation UploadSubcategoriesFromCSV($file: Upload!) {
        uploadSubCategoriesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const UPLOAD_SUBCATEGORIES_QUERY = `
    query UploadSubcategoriesFromCSV($file: Upload!) {
        uploadSubCategoriesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export async function uploadSubCategories(
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
            mutation: UPLOAD_SUBCATEGORIES_MUTATION,
            variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadSubCategoriesFromCSV
}

export async function queryUploadSubCategories(
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
            mutation: UPLOAD_SUBCATEGORIES_QUERY,
            variables: variables,
            headers: { authorization: authToken },
        })

    const res = await gqlTry(operation)
    return res.data?.uploadSubCategoriesFromCSV
}
