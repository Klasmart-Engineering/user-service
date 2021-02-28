import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { getUser, getUsers, updateUser, createUserAndValidate, getv1Users } from "../utils/operations/modelOps";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import faker from "faker";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { Paginated } from "../../src/utils/paginated.interface";

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
            const user = await createUserJoe(testClient);
            expect(user).to.exist;
        });
    });

    describe("setUser", () => {
        let user: User;
        let modifiedUser: any;

        before(async () => {
            user = await createUserJoe(testClient);
            modifiedUser = {
                user_id: user.user_id,
                given_name: faker.name.firstName(),
                family_name: faker.name.lastName(),
                email: faker.internet.email(),
                avatar: "my new avatar",
                date_of_birth: "03-1994",
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
            user = await createUserJoe(testClient);
        });

        it("should get user by ID", async () => {
            const gqlUser = await getUser(testClient, user.user_id, { authorization: JoeAuthToken });
            expect(gqlUser).to.exist;
            expect(user).to.include(gqlUser);
        });
    });

    describe("getv1Users", () => {
        let user: User;
        let originalAdmins: string[];
        beforeEach(async () => {
            await createUserJoe(testClient);
            user = await createUserBilly(testClient);
            for (let i = 1; i < 10; i++) {

                let anne = {
                    given_name: "Anne" + i,
                    family_name: "Bob",
                    email: "apollo" + i + "@calmid.com",
                    avatar: "anne_avatar"
                } as User

                await createUserAndValidate(testClient, anne)
            }

        });

        it("should get paged users as admin with no duplicates", async () => {
            let hasNextPage = true
            let hasPreviousPage = false
            let page = 0
            let after: string | undefined = undefined
            let before: string | undefined = undefined
            let first: number | undefined = 5
            let last: number | undefined = undefined
            let oldUsers: User[] = []
            do {
                page++
                const gqlUserConnection = await getv1Users(testClient, after, before, first, last, { authorization: JoeAuthToken });
                expect(gqlUserConnection).to.exist;
                let users = gqlUserConnection.edges
                let total = gqlUserConnection.total
                expect(total).to.equal(11)
                expect(users).to.exist
                expect(users?.length).to.equal(page !== 3 ? 5 : 1)
                if (page === 2) {
                    const bothUsers = users?.concat(oldUsers ?? []) ?? []
                    const usersMap = bothUsers.reduce(
                        (map, bothUser) => map.set(bothUser.user_id, bothUser),
                        new Map()
                    )
                    const uniqueUser = [...usersMap.values()]
                    expect(uniqueUser.length).to.equal(10)
                }
                oldUsers = users
                let pageInfo: any = gqlUserConnection.pageInfo
                expect(pageInfo).to.exist
                hasNextPage = pageInfo?.hasNextPage || false
                hasPreviousPage = pageInfo?.hasPreviousPage || false
                after = hasNextPage && page < 3 ? pageInfo?.endCursor : undefined
                first = hasNextPage && page < 3 ? 5 : undefined
                before = hasPreviousPage && page > 2 ? pageInfo?.startCursor : undefined
                last = hasPreviousPage && page > 2 ? 5 : undefined
            } while (page < 5)
            expect (page).to.equal(5)


        });
        it("should get paged users as user", async () => {
            const gqlUserConnection = await getv1Users(testClient, undefined, undefined, undefined, undefined, { authorization: BillyAuthToken });
            expect(gqlUserConnection).to.exist;
            let users = gqlUserConnection.edges
            let total = gqlUserConnection.total
            expect(total).to.equal(1)
            expect(users).to.exist
            expect(users?.length).to.equal(1)
            let pageInfo = gqlUserConnection.pageInfo
            expect(pageInfo).to.exist
            expect(!pageInfo?.hasNextPage)
        });

    });


})
