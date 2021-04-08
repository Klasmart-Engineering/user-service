import { ReadStream } from "typeorm/platform/PlatformTools";
import { ApolloServerTestClient } from "../../createTestClient";
import { gqlTry } from "../../gqlTry";
import { fileMockInput } from "../modelOps";


const UPLOAD_GRADES_MUTATION = `
    mutation UploadGradesFromCSV($file: Upload!) {
        uploadGradesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

const UPLOAD_GRADES_QUERY = `
    query UploadGradesFromCSV($file: Upload!) {
        uploadGradesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

export async function uploadGrades(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding)
    };

    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: UPLOAD_GRADES_MUTATION,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data?.uploadGradesFromCSV;
}

export async function queryUploadGrades(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding)
    };

    const { query } = testClient;

    const operation = () => query({
        query: UPLOAD_GRADES_QUERY,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data?.uploadGradesFromCSV;
}
