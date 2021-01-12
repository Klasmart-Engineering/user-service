import { expect } from "chai";
import { Connection } from "typeorm"
import { v4 as uuidv4 } from "uuid"
import { User } from "../../src/entities/user";
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { getUser, getUsers, createUserAndValidate, updateUser, getMe } from "../utils/operations/modelOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import faker from "faker";
import { generateToken, getJoeToken } from "../utils/testConfig";
import { userToPayload } from "../utils/operations/userOps"

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
            const gqlUser = await updateUser(testClient, modifiedUser, { authorization: getJoeToken() });
            expect(gqlUser).to.exist;
            expect(gqlUser).to.include(modifiedUser);
            const dbUser = await User.findOneOrFail(user.user_id);
            expect(dbUser).to.include(gqlUser);
        });
    });

    describe("getUsers", () => {
        let user: User;

        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should get users", async () => {
            const gqlUsers = await getUsers(testClient, undefined, undefined,{ authorization: getJoeToken() });

            expect(gqlUsers).to.exist;
            expect(gqlUsers.length).to.equal(1);
            expect(gqlUsers[0]).to.deep.include({
                user_id: user.user_id,
                given_name: user.given_name,
                family_name: user.family_name,
            });
        
        });

        it("should get more users", async () => {
            let anne = {
                given_name: "Anne",
                family_name: "Bob",
                email: user.email,
                avatar: "anne_avatar"
            } as User
            let user1 = await createUserAndValidate(testClient, anne);
            let user2 = await createUserBilly(testClient);
            const gqlUsers = await getUsers(testClient, undefined,undefined, { authorization: getJoeToken() });

            expect(gqlUsers).to.exist;
            expect(gqlUsers.length).to.equal(3);
            
        });
        it("should get Joe users", async () => {
            let anne = {
                given_name: "Anne",
                family_name: "Brown",
                email: user.email,
                avatar: "anne_avatar"
            } as User
            let user1 = createUserAndValidate(testClient, anne);
            let user2 = await createUserBilly(testClient);
            const gqlUsers = await getUsers(testClient, user.email, undefined,{ authorization: getJoeToken() });

            expect(gqlUsers).to.exist;
            expect(gqlUsers.length).to.equal(2);
            expect(gqlUsers[0]).to.deep.include({
                family_name: user.family_name,
            });
            it("should get +44207344141 users", async () => {
                let anne = {
                    given_name: "Anne",
                    family_name: "Brown",
                    phone: "+44207344141",
                    avatar: "anne_avatar"
                } as User
                let peter = {
                    given_name: "Peter",
                    family_name: "Brown",
                    phone: anne.phone,
                    avatar: "peter_avatar"
                } as User
                
                let user1 = createUserAndValidate(testClient, anne);
                let user2 = await createUserBilly(testClient);
                const gqlUsers = await getUsers(testClient, undefined, peter.phone, { authorization: getJoeToken() });
    
                expect(gqlUsers).to.exist;
                expect(gqlUsers.length).to.equal(2);
                expect(gqlUsers[0]).to.deep.include({
                    family_name: peter.family_name,
                });
    
            });

        });

    });

    describe("getUser", () => {
        let user: User;

        before(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should get user by ID", async () => {
            const gqlUser = await getUser(testClient, user.user_id, { authorization: getJoeToken() });
            expect(gqlUser).to.exist;
            expect(user).to.include(gqlUser);
        });
    });

    describe("getMe", () => {
        let user: User;
        before(async () => {
            await reloadDatabase();
        });
        it("Should create a user", async () => {
             let anne = {
                user_id: uuidv4(),
                given_name: "Anne",
                family_name: "Bob",
                email: "anne@nowhere.com",
                avatar: "anne_avatar"
            } as User
            const annToken = generateToken(userToPayload(anne))
            const gqlUser = await getMe(testClient, { authorization: annToken });
            expect(gqlUser).to.exist;
            const dbUser = await User.findOneOrFail(anne.user_id);
            expect(dbUser).to.include(gqlUser);
        });
    });
});