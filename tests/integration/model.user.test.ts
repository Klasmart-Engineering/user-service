import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { getUser, getUsers, updateUser, createUserAndValidate } from "../utils/operations/modelOps";
import { createAdminUser } from "../utils/testEntities";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import faker from "faker";
import { getAdminAuthToken } from "../utils/testConfig";

describe("model.user", () => {
    let connection: Connection;
    let originalAdmins: string[];
    let testClient: ApolloServerTestClient;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    describe("newUser", () => {
        it("should create a new user", async () => {
            const user = await createAdminUser(testClient);
            expect(user).to.exist;
        });
    });

    describe("setUser", () => {
        let user: User;
        let modifiedUser: any;

        before(async () => {
            user = await createAdminUser(testClient);
            modifiedUser = {
                user_id: user.user_id,
                given_name: faker.name.firstName(),
                family_name: faker.name.lastName(),
                email: faker.internet.email(),
                avatar: "my new avatar",
                date_of_birth: "03-1994",
                alternate_email: "a@a.com",
                alternate_phone: "+123456789"
            };
        });

        it("should modify an existing user", async () => {
            const gqlUser = await updateUser(testClient, modifiedUser, { authorization: getAdminAuthToken() });
            expect(gqlUser).to.exist;
            expect(gqlUser).to.include(modifiedUser);
            const dbUser = await User.findOneOrFail(user.user_id);
            expect(dbUser).to.include(gqlUser);
        });
    });

    describe("getUsers", () => {
        let user: User;

        before(async () => {
            user = await createAdminUser(testClient);
        });

        it("should get users", async () => {
            const gqlUsers = await getUsers(testClient, { authorization: getAdminAuthToken() });

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
            user = await createAdminUser(testClient);
        });

        it("should get user by ID", async () => {
            const gqlUser = await getUser(testClient, user.user_id, { authorization: getAdminAuthToken() });
            expect(gqlUser).to.exist;
            expect(user).to.include(gqlUser);
        });
    });
});
