import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Organization } from "../../src/entities/organization";
import { Role } from "../../src/entities/role";
import { createOrganization } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/testEntities";
import { accountUUID } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { JoeAuthToken } from "../utils/testConfig";

const GET_ORGANIZATIONS = `
    query getOrganizations {
        organizations {
            organization_id
            organization_name
        }
    }
`;

const GET_ORGANIZATION = `
    query myQuery($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            organization_id
            organization_name
        }
    }
`;

const RESET_ORGANIZATION_ROLES_PERMISSIONS = `
    mutation resetOrganizationRolesPermissions($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            resetDefaultRolesPermissions {
                role_id
                role_name
                permissions {
                    permission_name
                    role_id
                }
            }
        }
    }
`;

describe("model.organization", () => {
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

    describe("getOrganizations", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizations = res.data?.organizations as Organization[];
                expect(organizations).to.exist;
                expect(organizations).to.be.empty;
            });
        });

        context("when one", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
            });

            it("should return an array containing one organization", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizations = res.data?.organizations as Organization[];
                expect(organizations).to.exist;
                expect(organizations).to.have.lengthOf(1);
            });
        });
    });

    describe("getOrganization", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: accountUUID() },
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                expect(res.data?.organization).to.be.null;
            });
        });

        context("when one", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganization(testClient, user.user_id);
            });

            it("should return an array containing one organization", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: organization.organization_id },
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlOrganization = res.data?.organization as Organization;
                expect(gqlOrganization).to.exist;
                expect(organization).to.include(gqlOrganization);
            });
        });
    });

    describe("resetDefaultRolesPermissions", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

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
                organization = await createOrganization(testClient, user.user_id);
            });

            it("does not modify the default roles permissions", async () => {
                const { mutate } = testClient;
                const dbRoles = await organization.roles || []
                let dbPermissions = []
                expect(dbRoles).not.to.be.empty;

                for(const role of dbRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  dbPermissions.push(...permissions.map(permissionInfoFunc))
                }

                const res = await mutate({
                    mutation: RESET_ORGANIZATION_ROLES_PERMISSIONS,
                    variables: { organization_id: organization.organization_id },
                    headers: {
                        authorization: JoeAuthToken,
                    },
                });

                organization = await Organization.findOneOrFail(organization.organization_id);
                expect(dbRoles).not.to.be.empty;

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRoles = res.data?.organization?.resetDefaultRolesPermissions as Role[];
                expect(gqlRoles.map(roleInfoFunc)).to.deep.equal(dbRoles?.map(roleInfoFunc));
                let resetPermissions = []

                for(const role of gqlRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  resetPermissions.push(...permissions?.map(permissionInfoFunc))
                }

                expect(dbPermissions).to.deep.members(resetPermissions)
            });
        });

        context("when updated default permissions does not exists", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganization(testClient, user.user_id);
                const roles = await organization.roles || []
                await connection.manager.remove(roles)
            });

            it("does not create any default roles permissions", async () => {
                const { mutate } = testClient;
                organization = await Organization.findOneOrFail(organization.organization_id);
                let dbRoles = await organization.roles || []
                expect(dbRoles).to.be.empty;

                const res = await mutate({
                    mutation: RESET_ORGANIZATION_ROLES_PERMISSIONS,
                    variables: { organization_id: organization.organization_id },
                    headers: {
                        authorization: JoeAuthToken,
                    },
                });

                organization = await Organization.findOneOrFail(organization.organization_id);
                dbRoles = await organization.roles || []
                expect(dbRoles).to.be.empty;

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRoles = res.data?.organization?.resetDefaultRolesPermissions as Role[];
                expect(gqlRoles).to.be.empty;
            });
        });

        context("when outdated default permissions exists", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganization(testClient, user.user_id);
            });

            it("updates the default roles permissions", async () => {
                const { mutate } = testClient;
                let dbRoles = await organization.roles || []
                let defaultPermissions = []
                expect(dbRoles).not.to.be.empty;

                for(const role of dbRoles){
                  const permissions = await role.permissions || [];

                  defaultPermissions.push(...permissions.map(permissionInfoFunc))

                  if(role.role_name === "Organization Admin") { continue }

                  await connection.manager.remove(permissions);
                }

                const res = await mutate({
                    mutation: RESET_ORGANIZATION_ROLES_PERMISSIONS,
                    variables: { organization_id: organization.organization_id },
                    headers: {
                        authorization: JoeAuthToken,
                    },
                });

                organization = await Organization.findOneOrFail(organization.organization_id);
                dbRoles = await organization.roles || []
                expect(dbRoles).not.to.be.empty;

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRoles = res.data?.organization?.resetDefaultRolesPermissions as Role[];
                expect(gqlRoles.map(roleInfoFunc)).to.deep.equal(dbRoles?.map(roleInfoFunc));
                let resetPermissions = []

                for(const role of gqlRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  resetPermissions.push(...permissions?.map(permissionInfoFunc))
                }

                expect(defaultPermissions).to.deep.members(resetPermissions)
            });
        });

        context("when outdated duplicated default permissions exists", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganization(testClient, user.user_id);
                await organization._createDefaultRoles();
            });

            it("updates the all default roles permissions", async () => {
                const { mutate } = testClient;
                let dbRoles = await organization.roles || []
                let defaultPermissions = []
                expect(dbRoles).not.to.be.empty;

                for(const role of dbRoles){
                  const permissions = await role.permissions || [];

                  defaultPermissions.push(...permissions.map(permissionInfoFunc))

                  if(role.role_name === "Organization Admin") { continue }

                  await connection.manager.remove(permissions);
                }

                const res = await mutate({
                    mutation: RESET_ORGANIZATION_ROLES_PERMISSIONS,
                    variables: { organization_id: organization.organization_id },
                    headers: {
                        authorization: JoeAuthToken,
                    },
                });

                organization = await Organization.findOneOrFail(organization.organization_id);
                dbRoles = await organization.roles || []
                expect(dbRoles).not.to.be.empty;

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRoles = res.data?.organization?.resetDefaultRolesPermissions as Role[];
                expect(gqlRoles.map(roleInfoFunc)).to.deep.equal(dbRoles?.map(roleInfoFunc));
                let resetPermissions = []

                for(const role of gqlRoles){
                  const permissions = await role.permissions || [];

                  expect(permissions).not.to.be.empty
                  resetPermissions.push(...permissions?.map(permissionInfoFunc))
                }

                expect(defaultPermissions).to.deep.members(resetPermissions)
            });
        });
    });
});
