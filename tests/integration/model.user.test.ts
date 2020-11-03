import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import faker from "faker"
import { createTestClient } from "apollo-server-testing"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";

let connection: Connection;

before(async () => {
    connection = await createTestConnection();
});

after(async () => {
    await connection?.close();
});

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

describe("newUser", () => {
    it("should create a new user", async () => {
        const user = {
            user_name: faker.internet.userName(),
            email: faker.internet.email(),
        };

        const server = await createServer(new Model(connection), () => { });
        const { mutate } = createTestClient(server);

        const res = await mutate({
            mutation: NEW_USER,
            variables: user,
        });

        console.log(res);
        console.log(res.errors);
        expect(res.errors).to.be.undefined;
        expect(res.data.newUser).to.include(user);

        const dbUser = await User.findOne({ where: { email: user.email } });

        expect(dbUser).to.exist;
        expect(dbUser!.user_name).to.equal(user.user_name);
        expect(dbUser!.avatar).to.be.null;
    });
});

describe("getUsers", () => {
    it("should get users", async () => {
        const user = {
            user_name: faker.internet.userName(),
            email: faker.internet.email(),
        };

        const server = await createServer(new Model(connection), () => { });
        const { query, mutate } = createTestClient(server);

        await mutate({
            mutation: NEW_USER,
            variables: user,
        });

        const res = await query({
            query: GET_USERS,
        });

        console.log(res);
        console.log(res.errors);
        expect(res.errors).to.be.undefined;
        const users = res.data.users as User[];
        expect(users).to.exist;
        expect(users[users.length-1]).to.include(user);
    });
});