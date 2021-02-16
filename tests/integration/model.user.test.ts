import { expect } from "chai";
import { Connection } from "typeorm"
import { User } from "../../src/entities/user";
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { getUser, getUsers, getv1Users, updateUser, createUserAndValidate} from "../utils/operations/modelOps";
import { createUserBilly, createUserJoe} from "../utils/testEntities";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import faker from "faker";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { UserPermissions } from "../../src/permissions/userPermissions";

describe("model.user", () => {
    let connection: Connection;
    let originalAdmins: string[];
    let testClient: ApolloServerTestClient;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);

        originalAdmins = UserPermissions.ADMIN_EMAILS
        UserPermissions.ADMIN_EMAILS = ['joe@gmail.com']
    });

    after(async () => {
        UserPermissions.ADMIN_EMAILS = originalAdmins
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



describe("getv1Users", () => {
        let user: User;
        let originalAdmins: string[];
        beforeEach(async () => {
            await reloadDatabase();
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

        it("should get users as admin", async () => {
            const gqlUserConnection = await getv1Users(testClient, undefined, undefined, 5, undefined, { authorization: JoeAuthToken });
            expect(gqlUserConnection).to.exist;
            let users = gqlUserConnection.edges
            let total = gqlUserConnection.total
            expect(total).to.equal(11)
            expect(users).to.exist
            expect(users?.length).to.equal(5)
            let pageInfo = gqlUserConnection.pageInfo
            expect (pageInfo).to.exist
            expect(pageInfo?.hasNextPage)
            expect(!pageInfo?.hasPreviousPage)
            const gqlUserConnection2 = await getv1Users(testClient, pageInfo?.endCursor, undefined, 5, undefined,{ authorization: JoeAuthToken });
            expect(gqlUserConnection2.total).to.equal(total)
            expect(gqlUserConnection2).to.exist;
            let users2 = gqlUserConnection2.edges
            expect(users2?.length).to.equal(5);
            let pageInfo2 = gqlUserConnection2.pageInfo
            expect (pageInfo2).to.exist
            expect(pageInfo2?.hasNextPage)
            expect(pageInfo2?.hasPreviousPage)
            const bothUsers = users?.concat(users2??[])??[]
            const usersMap = bothUsers.reduce(
                            (map, bothUser) => map.set(bothUser.user_id, bothUser),
                            new Map()
                        )
            const uniqueUser = [...usersMap.values()]

            expect (uniqueUser.length).to.equal(10)
            const gqlUserConnection3 = await getv1Users(testClient, pageInfo2?.endCursor, undefined, 5, undefined,{ authorization: JoeAuthToken });
            expect(gqlUserConnection3).to.exist;
            expect(gqlUserConnection3.total).to.equal(total)
            let users3 = gqlUserConnection3.edges
            expect(users3?.length).to.equal(1);
            let pageInfo3 = gqlUserConnection3.pageInfo
            expect (pageInfo3).to.exist
            expect(!pageInfo3?.hasNextPage)
            expect(pageInfo3.hasPreviousPage)
            const gqlUserConnection4 = await getv1Users(testClient, undefined, pageInfo3?.startCursor, undefined, 5, { authorization: JoeAuthToken });
            expect(gqlUserConnection4).to.exist;
            expect(gqlUserConnection4.total).to.equal(total)
            let users4 = gqlUserConnection4.edges
            expect(users4?.length).to.equal(5);
            let pageInfo4 = gqlUserConnection4.pageInfo
            expect (pageInfo4).to.exist
            expect(pageInfo4?.hasNextPage)
            expect(pageInfo4?.hasPreviousPage)
            const gqlUserConnection5 = await getv1Users(testClient, undefined, pageInfo4?.startCursor, undefined, 5, { authorization: JoeAuthToken });
            expect(gqlUserConnection5).to.exist;
            expect(gqlUserConnection5.total).to.equal(total)
            let users5 = gqlUserConnection4.edges
            expect(users5?.length).to.equal(5);
            let pageInfo5 = gqlUserConnection5.pageInfo
            expect (pageInfo5).to.exist
            expect(pageInfo5?.hasNextPage)
            expect(!pageInfo5?.hasPreviousPage)


        });
        it("should get users as user", async () => {
            const gqlUserConnection = await getv1Users(testClient, undefined, undefined, undefined, undefined, { authorization: BillyAuthToken });
            expect(gqlUserConnection).to.exist;
            let users = gqlUserConnection.edges
            let total = gqlUserConnection.total
            expect(total).to.equal(1)
            expect(users).to.exist
            expect(users?.length).to.equal(1)
            let pageInfo = gqlUserConnection.pageInfo
            expect (pageInfo).to.exist
            expect(!pageInfo?.hasNextPage)
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