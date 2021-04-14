import { ReadStream } from "typeorm/platform/PlatformTools";
import { ApolloServerTestClient } from "../../createTestClient";
import { gqlTry } from "../../gqlTry";
import { fileMockInput } from "../modelOps";

const UPLOAD_PROGRAMS_MUTATION = `
    mutation UploadProgramsFromCSV($file: Upload!) {
        uploadProgramsFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

const UPLOAD_PROGRAMS_QUERY = `
    query UploadProgramsFromCSV($file: Upload!) {
        uploadProgramsFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

export async function uploadPrograms(
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
        mutation: UPLOAD_PROGRAMS_MUTATION,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data?.uploadProgramsFromCSV;
}

export async function queryUploadPrograms(
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
        query: UPLOAD_PROGRAMS_QUERY,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data?.uploadProgramsFromCSV;
}
