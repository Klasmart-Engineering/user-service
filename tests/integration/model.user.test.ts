import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { getUser, getUsers, updateUser } from "../utils/operations/modelOps";
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

    function reloadDatabase() {
        return connection?.synchronize(true);
    }

    describe("newUser", () => {
        before(async () => await reloadDatabase());

        it("should create a new user", async () => {
            const user = await createUserJoe(testClient);
            expect(user).to.exist;
        });
    });

    describe("setUser", () => {
        let user: User;

        before(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should modify an existing user", async () => {
            const gqlUpdatedUser = await updateUser(testClient, user);
            const dbUser = await User.findOneOrFail(user.user_id);
            expect(dbUser).to.include(gqlUpdatedUser);
        });
    });

    describe("getUsers", () => {
        let user: User;

        before(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should get users", async () => {
            const gqlUsers = await getUsers(testClient);

            expect(gqlUsers).to.exist;
            expect(gqlUsers.length).to.equal(1);
            expect(gqlUsers[0]).to.deep.include({user_id: user.user_id, user_name: user.user_name});
            expect(user).to.include(gqlUsers[0]);
        });
    });

    describe("getUser", () => {
        let user: User;

        before(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should get user by ID", async () => {
            const gqlUser = await getUser(testClient, user.user_id);
            expect(gqlUser).to.exist;
            expect(user).to.include(gqlUser);
        });
    });
});