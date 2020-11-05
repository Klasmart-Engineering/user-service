import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import faker from "faker"
import { createTestClient } from "apollo-server-testing"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";

const NEW_USER = `
    mutation newUser(
        $user_name: String
        $email: String
        $avatar: String) {
        newUser(
            user_name: $user_name
            email: $email
            avatar: $avatar
        ) {
            user_id
            user_name
            email
            avatar
        }
    }
`;

const SET_USER = `
    mutation setUser(
        $user_id: ID!
        $user_name: String
        $email: String
        $avatar: String) {
        user(
            user_id: $user_id
            user_name: $user_name
            email: $email
            avatar: $avatar
        ) {
            user_id
            user_name
            email
            avatar
        }
    }
`;

const GET_USERS = `
    query users {
        users {
            user_id
            user_name
            email
            avatar
        }
    }
`;

const GET_USER = `
    query getUser($user_id: ID!) {
        user(user_id: $user_id) {
            user_id
            user_name
            email
            avatar
        }
    }
`;

describe("model.user", () => {
    let connection: Connection;

    before(async () => {
        connection = await createTestConnection();
    });

    after(async () => {
        await connection?.close();
    });

    describe("newUser", () => {
        it("should create a new user", async () => {
            const user = {
                user_name: faker.internet.userName(),
                email: faker.internet.email(),
            };

            const server = createServer(new Model(connection), () => { });
            const { mutate } = createTestClient(server);

            const res = await mutate({
                mutation: NEW_USER,
                variables: user,
            });

            expect(res.errors).to.be.undefined;
            expect(res.data.newUser).to.include(user);

            const dbUser = await User.findOne({ where: { email: user.email } });

            expect(dbUser).to.exist;
            expect(dbUser!.user_name).to.equal(user.user_name);
            expect(dbUser!.avatar).to.be.null;
        });
    });

    describe("setUser", () => {
        it("should modify an existing user", async () => {
            const originalUser = {
                user_name: faker.internet.userName(),
                email: faker.internet.email(),
                avatar: "my avatar",
            };

            const server = createServer(new Model(connection), () => { });
            const { mutate } = createTestClient(server);

            await mutate({
                mutation: NEW_USER,
                variables: originalUser,
            });

            let dbUser = await User.findOne({ where: { email: originalUser.email } });

            const modifiedUser = {
                user_id: dbUser!.user_id,
                user_name: faker.internet.userName(),
                email: faker.internet.email(),
                avatar: "my new avatar",
            };

            const res = await mutate({
                mutation: SET_USER,
                variables: modifiedUser,
            });

            expect(res.errors).to.be.undefined;
            expect(res.data.user).to.include(modifiedUser);

            dbUser = await User.findOne(dbUser!.user_id);

            expect(dbUser!.email).to.equal(modifiedUser.email);
            expect(dbUser!.user_name).to.equal(modifiedUser.user_name);
            expect(dbUser!.avatar).to.equal(modifiedUser.avatar);
        });
    });

    describe("getUsers", () => {
        it("should get users", async () => {
            const user = {
                user_name: faker.internet.userName(),
                email: faker.internet.email(),
            };

            const server = createServer(new Model(connection), () => { });
            const { query, mutate } = createTestClient(server);

            await mutate({
                mutation: NEW_USER,
                variables: user,
            });

            const res = await query({
                query: GET_USERS,
            });

            expect(res.errors).to.be.undefined;
            const users = res.data.users as User[];
            expect(users).to.exist;
            expect(users[users.length - 1]).to.include(user);
        });
    });

    describe("getUser", () => {
        it("should get user by ID", async () => {
            const user = {
                user_name: faker.internet.userName(),
                email: faker.internet.email(),
                avatar: "my avatar",
            };

            const server = createServer(new Model(connection), () => { });
            const { query, mutate } = createTestClient(server);

            await mutate({
                mutation: NEW_USER,
                variables: user,
            });

            let dbUser = await User.findOneOrFail({ where: { email: user.email } });

            const res = await query({
                query: GET_USER,
                variables: { user_id: dbUser.user_id },
            });

            expect(res.errors).to.be.undefined;
            const returnedUser = res.data.user as User;
            expect(returnedUser).to.exist;
            expect(returnedUser).to.include(user);
        });
    });
});