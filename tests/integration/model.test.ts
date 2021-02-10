import { expect, use } from "chai";
import { Connection } from "typeorm";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { JoeAuthToken, JoeAuthWithoutIdToken, BillyAuthToken } from "../utils/testConfig";
import { createDefaultRoles, getAllOrganizations, getOrganizations, switchUser, me, myUsers } from "../utils/operations/modelOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { Model } from "../../src/model";
import { User } from "../../src/entities/user";
import { UserPermissions } from "../../src/permissions/userPermissions";
import { Organization } from "../../src/entities/organization";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

describe("model", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let originalAdmins: string[];

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

    beforeEach(async () => {
        await connection.synchronize(true);
        await createDefaultRoles(testClient, { authorization: JoeAuthToken });
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
            context("and no user_id cookie is provided", () => {
                it("creates and returns the expected user", async () => {
                    const gqlUserWithoutId = await me(testClient, { authorization: JoeAuthWithoutIdToken}, { user_id: user.user_id });
                    const gqlUser = await me(testClient, { authorization: JoeAuthToken}, { user_id: user.user_id });

                    expect(gqlUserWithoutId.user_id).to.eq(gqlUser.user_id)
                });
            });

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

    describe("getOrganizations", () => {
        let user: User;
        let organization: Organization;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            organization = await createOrganizationAndValidate(testClient, user.user_id);
        });

        context("when user is not logged in", () => {
            it("returns an empty list of organizations", async () => {
                const gqlOrgs = await getAllOrganizations(testClient, { authorization: undefined });

                expect(gqlOrgs).to.be.empty;
            });
        });

        context("when user is logged in", () => {
            const orgInfo = (org: Organization) => { return org.organization_id }
            let otherOrganization: Organization

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherOrganization = await createOrganizationAndValidate(testClient, otherUser.user_id, "Billy's Org");
            });

            context("and the user is not an admin", () => {
                it("raises an error", async () => {
                    const fn = () => getAllOrganizations(testClient, { authorization: BillyAuthToken });

                    expect(fn()).to.be.rejected;
                });
            });

            context("and there is no filter in the organization ids", () => {
                it("returns the expected organizations", async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, { authorization: JoeAuthToken });

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
                        organization.organization_id,
                        otherOrganization.organization_id
                    ]);
                });
            });

            context("and there is a filter in the organization ids", () => {
                it("returns the expected organizations", async () => {
                    const gqlOrgs = await getOrganizations(
                        testClient,
                        [organization.organization_id],
                        { authorization: JoeAuthToken }
                    );

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([organization.organization_id]);
                });
            });
        });
    });

    describe("createDefaultRoles", () => {
        const roleInfoFunc =  function (role: any) {
          return { role_id: role.role_id, role_name: role.role_name }
        };
        const permissionInfoFunc =  function (permission: any) {
          return { permission_name: permission.permission_name, role_id: permission.role_id }
        };

        context("when updated default permissions exists", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganizationAndValidate(testClient, user.user_id);
            });

            it("does not modify the default roles permissions", async () => {
                const { mutate } = testClient;
                const dbRoles = await organization.roles({}, {}, {}) || []
                let dbPermissions = []
                expect(dbRoles).not.to.be.empty;

                for(const role of dbRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  dbPermissions.push(...permissions.map(permissionInfoFunc))
                }


                const gqlRoles = await createDefaultRoles(testClient, { authorization: JoeAuthToken });

                organization = await Organization.findOneOrFail(organization.organization_id);
                const dbNewRoles = await organization.roles({}, {}, {}) || []
                expect(dbNewRoles).not.to.be.empty;

                expect(gqlRoles.map(roleInfoFunc)).to.deep.equal(dbNewRoles?.map(roleInfoFunc));
                let resetPermissions = []

                for(const role of dbNewRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  resetPermissions.push(...permissions?.map(permissionInfoFunc))
                }

                expect(dbPermissions).to.deep.members(resetPermissions)
            });
        });

        context("when outdated default permissions exists", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganizationAndValidate(testClient, user.user_id);
            });

            it("updates the default roles permissions", async () => {
                const { mutate } = testClient;
                let dbRoles = await organization.roles({}, {}, {}) || []
                let defaultPermissions = []
                expect(dbRoles).not.to.be.empty;

                for(const role of dbRoles){
                  const permissions = await role.permissions || [];

                  defaultPermissions.push(...permissions.map(permissionInfoFunc))

                  if(role.role_name === "Organization Admin") { continue }

                  await connection.manager.remove(permissions);
                }

                const gqlRoles = await createDefaultRoles(testClient, { authorization: JoeAuthToken });

                organization = await Organization.findOneOrFail(organization.organization_id);
                const dbNewRoles = await organization.roles({}, {}, {}) || []
                expect(dbNewRoles).not.to.be.empty;

                expect(gqlRoles.map(roleInfoFunc)).to.deep.equal(dbNewRoles?.map(roleInfoFunc));
                let resetPermissions = []

                for(const role of dbNewRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  resetPermissions.push(...permissions?.map(permissionInfoFunc))
                }

                expect(defaultPermissions).to.deep.members(resetPermissions)
            });
        });
    });
});
