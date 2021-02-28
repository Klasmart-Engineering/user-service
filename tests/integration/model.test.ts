import { expect, use } from "chai";
import { Connection } from "typeorm";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { JoeAuthToken, JoeAuthWithoutIdToken, BillyAuthToken } from "../utils/testConfig";
import { createAgeRange } from "../factories/ageRange.factory";
import { createOrganization } from "../factories/organization.factory";
import { getAgeRange, getAllOrganizations, getPermissions, getOrganizations, switchUser, me, myUsers } from "../utils/operations/modelOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { addUserToOrganizationAndValidate } from "../utils/operations/organizationOps";
import { Model } from "../../src/model";
import { AgeRange } from "../../src/entities/ageRange";
import { User } from "../../src/entities/user";
import { Permission } from "../../src/entities/permission";
import { Organization } from "../../src/entities/organization";
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

    describe("getPermissions", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            it("raises an error", async () => {
                const fn = () => getPermissions(testClient, { authorization: undefined });

                expect(fn()).to.be.rejected;
            });
        });

        context("when user is logged in", () => {
            const permissionInfo = (permission: Permission) => { return permission.permission_id }

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
            });

            context("and the user is not an admin", () => {
                it("returns paginated results", async () => {
                    const gqlPermissions = await getPermissions(testClient, { authorization: BillyAuthToken });

                    expect(gqlPermissions?.permissions?.edges).to.not.be.empty
                    expect(gqlPermissions?.permissions?.pageInfo).to.not.be.empty
                    expect(gqlPermissions?.permissions?.total).to.not.be.undefined
                });

                it("returns all the permissions available", async () => {
                    let gqlPermissions = await getPermissions(testClient, { authorization: BillyAuthToken });
                    const dbPermissions = await Permission.find() || []

                    const permissions = gqlPermissions?.permissions?.edges || []
                    let hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                    while(hasNext) {
                        const endCursor = gqlPermissions?.permissions?.pageInfo?.endCursor
                        gqlPermissions = await getPermissions(testClient, { authorization: BillyAuthToken }, endCursor);
                        const morePermissions = gqlPermissions?.permissions?.edges || []
                        hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                        for(const permission of morePermissions) {
                            permissions.push(permission)
                        }
                    }

                    expect(permissions.map(permissionInfo)).to.deep.members(dbPermissions.map(permissionInfo))
                });
            });

            context("and the user is an admin", () => {
                it("returns paginated results", async () => {
                    const gqlPermissions = await getPermissions(testClient, { authorization: JoeAuthToken });

                    expect(gqlPermissions?.permissions?.edges).to.not.be.empty
                    expect(gqlPermissions?.permissions?.pageInfo).to.not.be.empty
                    expect(gqlPermissions?.permissions?.total).to.not.be.undefined
                });

                it("returns all the permissions available", async () => {
                    let gqlPermissions = await getPermissions(testClient, { authorization: JoeAuthToken });
                    const dbPermissions = await Permission.find() || []

                    const permissions = gqlPermissions?.permissions?.edges || []
                    let hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                    while(hasNext) {
                        const endCursor = gqlPermissions?.permissions?.pageInfo?.endCursor
                        gqlPermissions = await getPermissions(testClient, { authorization: JoeAuthToken }, endCursor);
                        const morePermissions = gqlPermissions?.permissions?.edges || []
                        hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                        for(const permission of morePermissions) {
                            permissions.push(permission)
                        }
                    }

                    expect(permissions.map(permissionInfo)).to.deep.members(dbPermissions.map(permissionInfo))
                });
            });
        });
    });

    describe("getAgeRange", () => {
        let user: User;
        let ageRange: AgeRange;
        let organizationId: string;

        const ageRangeInfo = (ageRange: AgeRange) => {
            return {
                id: ageRange.id,
                name: ageRange.name,
                high_value: ageRange.high_value,
                high_value_unit: ageRange.high_value_unit,
                low_value: ageRange.low_value,
                low_value_unit: ageRange.low_value_unit,
                system: ageRange.system,
            }
        }

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            ageRange = createAgeRange(org)
            await connection.manager.save(ageRange)
        });

        context("when user is not logged in", () => {
            it("returns no age range", async () => {
                const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: undefined });

                expect(gqlAgeRange).to.be.null;
            });
        });

        context("when user is logged in", () => {
            let otherUserId: string;

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherUserId = otherUser.user_id
            });

            context("and the user is not an admin", () => {
                context("and it belongs to the organization from the age range", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: BillyAuthToken });

                        expect(gqlAgeRange).not.to.be.null;
                        expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(ageRangeInfo(ageRange))
                    });
                });

                context("and it does not belongs to the organization from the age range", () => {
                    it("returns no age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: BillyAuthToken });

                        expect(gqlAgeRange).to.be.null;
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and it belongs to the organization from the age range", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, user.user_id, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: JoeAuthToken });

                        expect(gqlAgeRange).not.to.be.null;
                        expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(ageRangeInfo(ageRange))
                    });
                });

                context("and it does not belongs to the organization from the age range", () => {
                    it("returns the expected age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: JoeAuthToken });

                        expect(gqlAgeRange).not.to.be.null;
                        expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(ageRangeInfo(ageRange))
                    });
                });
            });
        });
    });
});
