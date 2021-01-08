import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { createUserJoe } from "../utils/testEntities";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";

describe("model.user", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    beforeEach(async () => {
        await connection?.synchronize(true);
    });

    describe("getSchool", () => {
        // TODO: Add tests.
    });
});