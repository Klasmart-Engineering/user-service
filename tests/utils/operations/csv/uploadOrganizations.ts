import { Stream } from "stream";
import { ReadStream } from "typeorm/platform/PlatformTools";
import { ApolloServerTestClient } from "../../createTestClient";
import { gqlTry } from "../../gqlTry";


const UPLOAD_ORGANIZATIONS_MUTATION = `
    mutation UploadOrganizationsFromCSV($file: Upload!) {
        uploadOrganizationsFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

const UPLOAD_ORGANIZATIONS_QUERY = `
    query UploadOrganizationsFromCSV($file: Upload!) {
        uploadOrganizationsFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`;

function fileMockInput(file: Stream, filename: string, mimetype: string, encoding: string) {
    return {
        resolve: () => {},
        reject: () => {},
        promise: new Promise((resolve) => resolve({
            filename,
            mimetype,
            encoding,
            createReadStream: () => file
        })),
        file: {
            filename,
            mimetype,
            encoding,
            createReadStream: () => file
        }
    }
}

export async function uploadOrganizations(
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
        mutation: UPLOAD_ORGANIZATIONS_MUTATION,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data?.uploadOrganizationsFromCSV;
}

export async function queryUploadOrganizations(
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
        query: UPLOAD_ORGANIZATIONS_QUERY,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data;
}
