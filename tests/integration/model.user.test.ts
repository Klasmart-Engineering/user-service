import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { getUser, getUsers, updateUser } from "../utils/operations/modelOps";
import { createUserJoe } from "../utils/testEntities";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import faker from "faker";
import { JoeAuthToken } from "../utils/testConfig";

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

    describe("myUser", () => {
        // TODO: Add tests.
    });

    describe("newUser", () => {
        before(async () => await reloadDatabase());

        it("should create a new user", async () => {
            const user = await createUserJoe(testClient);
            expect(user).to.exist;
        });
    });

    describe("setUser", () => {
        let user: User;
        let modifiedUser: any;

        before(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
            modifiedUser = {
                user_id: user.user_id,
                given_name: faker.name.firstName(),
                family_name: faker.name.lastName(),
                email: faker.internet.email(),
                avatar: "my new avatar",
            };
        });

        it("should modify an existing user", async () => {
            const gqlUser = await updateUser(testClient, modifiedUser, { authorization: JoeAuthToken });
            expect(gqlUser).to.exist;
            expect(gqlUser).to.include(modifiedUser);
            const dbUser = await User.findOneOrFail(user.user_id);
            expect(dbUser).to.include(gqlUser);
        });
    });

    describe("getUsers", () => {
        let user: User;

        before(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should get users", async () => {
            const gqlUsers = await getUsers(testClient, { authorization: JoeAuthToken });

            expect(gqlUsers).to.exist;
            expect(gqlUsers.length).to.equal(1);
            expect(gqlUsers[0]).to.deep.include({
                user_id: user.user_id,
                given_name: user.given_name,
                family_name: user.family_name,
            });
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
            const gqlUser = await getUser(testClient, user.user_id, { authorization: JoeAuthToken });
            expect(gqlUser).to.exist;
            expect(user).to.include(gqlUser);
        });
    });
});