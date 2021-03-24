import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";
import { ReadStream } from "fs";
import { Headers } from 'node-mocks-http';

const GENERIC_CSV_UPLOAD_MUTATION = `
    mutation GenericCSVFileUpload($file: Upload!) {
        genericCSVFileUpload(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

function fileMockInput(
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    return {
        resolve: () => { },
        reject: () => { },
        promise: new Promise((resolve) => {
            resolve({
                filename,
                mimetype,
                encoding,
                createReadStream: () => file,
            })
        }),
        file: {
            filename,
            mimetype,
            encoding,
            createReadStream: () => file,
        }
    };
}

export async function uploadFile(
    testClient: ApolloServerTestClient,
    file: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string,
    headers: Headers
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding)
    };


    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: GENERIC_CSV_UPLOAD_MUTATION,
        variables: variables,
        headers: headers
    });

    const res = await gqlTry(operation);
    return res.data?.genericCSVFileUpload;
}


