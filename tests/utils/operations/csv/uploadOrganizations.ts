import { ReadStream } from "typeorm/platform/PlatformTools";
import { ApolloServerTestClient } from "../../createTestClient";
import { gqlTry } from "../../gqlTry";
import { fileMockInput } from "../isMIMETypeDirectiveOps";

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

    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: UPLOAD_ORGANIZATIONS_QUERY,
        variables: variables,
    });

    const res = await gqlTry(operation);
    return res.data?.uploadOrganizationsFromCSV;
}