import { expect, use } from "chai";
import { Connection } from "typeorm";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { JoeAuthToken } from "../utils/testConfig";
import { switchUser, me, myUsers } from "../utils/operations/modelOps";
import { Model } from "../../src/model";
import { User } from "../../src/entities/user";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

describe("model", () => {
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
        await connection.synchronize(true);
    });

    describe("switchUser", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            it("raises an error", async () => {
                const fn = () => switchUser(testClient, user.user_id, { authorization: undefined });

                expect(fn()).to.be.rejected;
            });
        });

        context("when user is logged in", () => {
            context("and the user_id is on the account", () => {
                it("returns the expected user", async () => {
                    const gqlRes = await switchUser(testClient, user.user_id, { authorization: JoeAuthToken });
                    const gqlUser = gqlRes.data?.switch_user as User
                    const gqlCookies = gqlRes.extensions?.cookies

                    expect(gqlUser.user_id).to.eq(user.user_id)
                    expect(gqlCookies.user_id?.value).to.eq(user.user_id)
                });
            });

            context("and the user_id is on the account", () => {
                let otherUser: User;

                beforeEach(async () => {
                    otherUser= await createUserBilly(testClient);
                });

                it("raises an error", async () => {
                    const fn = () => switchUser(testClient, otherUser.user_id, { authorization: JoeAuthToken });

                    expect(fn()).to.be.rejected;
                });
            });
        });
    });

    describe("getMyUser", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            context("and the user_id cookie is not provided", () => {
                it("returns null", async () => {
                    const gqlUser = await me(testClient, { authorization: undefined });

                    expect(gqlUser).to.be.null
                });
            });

            context("and the user_id cookie is provided", () => {
                it("returns null", async () => {
                    const gqlUser = await me(testClient, { authorization: undefined}, { user_id: user.user_id });

                    expect(gqlUser).to.be.null
                });
            });
        });

        context("when user is logged in", () => {
            context("and the correct user_id cookie is provided", () => {
                it("returns the expected user", async () => {
                    const gqlUser = await me(testClient, { authorization: JoeAuthToken}, { user_id: user.user_id });

                    expect(gqlUser.user_id).to.eq(user.user_id)
                });
            });

            context("and the incorrect user_id cookie is provided", () => {
                let otherUser: User;

                beforeEach(async () => {
                    otherUser= await createUserBilly(testClient);
                });

                it("returns null", async () => {
                    const gqlUser = await me(testClient, { authorization: JoeAuthToken}, { user_id: otherUser.user_id });

                    expect(gqlUser).to.be.null
                });
            });
        });
    });

    describe("myUsers", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            it("raises an error", async () => {
                const fn = () => myUsers(testClient, { authorization: undefined });

                expect(fn()).to.be.rejected;
            });
        });

        context("when user is logged in", () => {
            const userInfo = (user: User) => { return user.user_id }

            it("returns the expected users", async () => {
                const gqlUsers = await myUsers(testClient, { authorization: JoeAuthToken });

                expect(gqlUsers.map(userInfo)).to.deep.eq([user.user_id])
            });
        });
    });
});
