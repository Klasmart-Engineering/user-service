import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Role } from "../../src/entities/role";
import { addUserToOrganizationAndValidate, createRole, createSchool } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate, userToPayload } from "../utils/operations/userOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { accountUUID, User } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { JoeAuthToken, BillyAuthToken, generateToken } from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { createDefaultRoles, createUserAndValidate } from "../utils/operations/modelOps";
import { UserPermissions } from "../../src/permissions/userPermissions";
import { OrganizationOwnership } from "../../src/entities/organizationOwnership";
import { RoleConnection } from "../../src/utils/pagingconnections";


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

const GET_V1_ROLES = `
    query myQuery($after:String,$before:String,$first:Int,$last:Int) {
        roles_v1(after:$after,before:$before,first:$first,last:$last) {
            total
            edges {
                role_id
                role_name
            }
            pageInfo{
                hasPreviousPage
                hasNextPage
                endCursor
                startCursor
            }
        }
    }
`;

describe("model.role", () => {
    let connection: Connection;
    let originalAdmins: string[];
    let testClient: ApolloServerTestClient;
    let roleInfo = (role: Role) => { return role.role_id }

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

    describe("getRoles", () => {
        context("when none", () => {
            it("returns only the system roles", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const systemRoles = await Role.find({ where: { system_role: true } })

                const roles = res.data?.roles as Role[]
                expect(roles.map(roleInfo)).to.deep.eq(systemRoles.map(roleInfo))
            });
        });

        context("when one", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                await createRole(testClient, organization.organization_id);
            });

            it("should return an array containing the default roles", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
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
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRole = res.data?.role as Role;
                expect(gqlRole).to.exist;
                expect(role).to.include(gqlRole);
            });
        });
    });
   
});
