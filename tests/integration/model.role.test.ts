import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Role } from "../../src/entities/role";
import { addUserToOrganizationAndValidate, createRole, createSchool} from "../utils/operations/organizationOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { accountUUID } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { JoeAuthToken, BillyAuthToken, BillySuperAdminAuthToken} from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { addUserToSchool } from "../utils/operations/schoolOps";

const GET_ROLES = `
    query getRoles {
        roles {
            role_id
            role_name
        }
    }
`;

const GET_ROLE = `
    query myQuery($role_id: ID!) {
        role(role_id: $role_id) {
            role_id
            role_name
        }
    }
`;

describe("model.role", () => {
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

    describe("getRoles", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                await createUserJoe(testClient);
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.be.empty;
            });
        });

        context("we create two roles and add one to the organsization membership and both to the school membership ", () => {
            beforeEach(async () => {
                const orgOwnerId = (await createUserBilly(testClient)).user_id;
                const userId = (await createUserJoe(testClient)).user_id;
                const organizationId = (await createOrganizationAndValidate(testClient, orgOwnerId, "myOrg", BillyAuthToken)).organization_id;
                const roleId = (await createRole(testClient, organizationId, "first role", "first role description", BillyAuthToken)).role_id;
                const role2Id = (await createRole(testClient, organizationId, "other role", "other role description", BillyAuthToken)).role_id;
                await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: BillyAuthToken });
                await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId, { authorization: BillyAuthToken });
                const school = await createSchool(testClient, organizationId, "school 1", { authorization: BillyAuthToken })
                expect(school).to.exist
                const schoolId = school?.school_id;
                await addUserToSchool(testClient, userId, schoolId, { authorization: BillyAuthToken })
                await addRoleToSchoolMembership(testClient, userId, schoolId, role2Id,{ authorization: BillyAuthToken })
                await addRoleToSchoolMembership(testClient, userId, schoolId, roleId,{ authorization: BillyAuthToken })


            });

            it("should return an array containing two roles", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.have.lengthOf(2);
            });

            it("should return an array containing one role for the organization owner", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: BillyAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.have.lengthOf(1);
            });
            it("should return an array containing all the roles in the db as admin user", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: BillySuperAdminAuthToken },
                });

                const dbRoles = await Role.find();

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.have.lengthOf(dbRoles.length);
            });
            it("should return an array containing no roles as no token", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.have.lengthOf(0);
            });
        });
        context("when one more", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                await createUserBilly(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                await createRole(testClient, organization.organization_id);
            });

            it("should return an array containing the default roles", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: BillySuperAdminAuthToken },
                });

                const dbRoles = await Role.find();

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.have.lengthOf(dbRoles.length);
            });
        });
    });

    describe("getRole", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: accountUUID() },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                expect(res.data?.role).to.be.null;
            });
        });

        context("when one", () => {
            let role: Role;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                role = await createRole(testClient, organization.organization_id);
            });

            it("should return an array containing the default roles", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: role.role_id },
                    headers: { authorization: BillySuperAdminAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRole = res.data?.role as Role;
                expect(gqlRole).to.exist;
                expect(role).to.include(gqlRole);
            });
        });
    });
});
