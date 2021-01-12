import { expect } from "chai";
import { Connection } from "typeorm";
import { Model } from "../../src/model";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganizationAndValidate, createRole } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createTestConnection } from "../utils/testConnection";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { PermissionName } from "../../src/permissions/permissionNames";
import { denyPermission, getPermissionViaRole, grantPermission, revokePermission, updateRole } from "../utils/operations/roleOps";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { Role } from "../../src/entities/role";
import { Permission } from "../../src/entities/permission";
import chaiAsPromised from "chai-as-promised";
import chai from "chai"
chai.use(chaiAsPromised);

describe("role", () => {
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

    describe("set", () => {
        const originalRoleName = "Original Role Name";
        const newRoleName = "New Role Name";
        let organizationId: string;
        let userId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            roleId = (await createRole(testClient, organizationId, originalRoleName)).role_id;
            await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId, { authorization: JoeAuthToken });
        });

        context("when user has the 'edit groups' permission within the organization", () => {
            beforeEach(async () => {
                await grantPermission(testClient, roleId, PermissionName.edit_groups_30330, { authorization: JoeAuthToken });
            });

            it("should return the modified role and update the database entry", async () => {
                const gqlRole = await updateRole(testClient, roleId, newRoleName, { authorization: BillyAuthToken });

                const dbRole = await Role.findOneOrFail({ where: { role_id: roleId } });
                expect(gqlRole).to.exist;
                expect(gqlRole).to.include({ role_id: roleId, role_name: newRoleName });
                expect(dbRole).to.include(gqlRole);
            });
        });

        context("when user does not have the 'edit groups' permission within the organization", () => {
            it("should throw a permission exception, and not update the database entry", async () => {
                const fn = () => updateRole(testClient, roleId, newRoleName, { authorization: BillyAuthToken });
                expect(fn()).to.be.rejected;

                const dbRole = await Role.findOneOrFail({ where: { role_id: roleId } });
                expect(dbRole.role_name).to.equal(originalRoleName);
            });
        });
    });

    describe("permission", () => {
        const nameOfPermissionToGet = PermissionName.create_school_20220;
        let organizationId: string;
        let userId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            roleId = (await createRole(testClient, organizationId, "My Role")).role_id;
            await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId, { authorization: JoeAuthToken });
            await grantPermission(testClient, roleId, nameOfPermissionToGet, { authorization: JoeAuthToken });
        });

        context("when user has the 'view role permissions' permission within the organization", () => {
            beforeEach(async () => {
                await grantPermission(testClient, roleId, PermissionName.view_role_permissions_30112, { authorization: JoeAuthToken });
            });

            it("should return the permission", async () => {
                const gqlPermission = await getPermissionViaRole(testClient, roleId, nameOfPermissionToGet, { authorization: BillyAuthToken });

                expect(gqlPermission).to.exist;
                expect(gqlPermission).to.include({ role_id: roleId, permission_name: nameOfPermissionToGet });
            });
        });

        context("when user does not have the 'view role permissions' permission within the organization", () => {
            it("should throw a permission exception", async () => {
                const fn = () => getPermissionViaRole(testClient, roleId, nameOfPermissionToGet, { authorization: BillyAuthToken });
                expect(fn()).to.be.rejected;
            });
        });
    });

    describe("grant", () => {
        const nameOfPermissionToGrant = PermissionName.edit_groups_30330;
        let organizationId: string;
        let userId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            roleId = (await createRole(testClient, organizationId, "My Role")).role_id;
            await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId, { authorization: JoeAuthToken });
        });

        context("when user has the 'edit role permissions' permission within the organization", () => {
            beforeEach(async () => {
                await grantPermission(testClient, roleId, PermissionName.edit_role_permissions_30332, { authorization: JoeAuthToken });
            });

            context("and permission entry exists with allow set to false", () => {
                beforeEach(async () => {
                    await denyPermission(testClient, roleId, nameOfPermissionToGrant, { authorization: JoeAuthToken });
                });

                it("should return the permission with 'allow' set to true and update the database entry", async () => {
                    const gqlPermission = await grantPermission(testClient, roleId, nameOfPermissionToGrant, { authorization: BillyAuthToken });
    
                    const dbPermission = await Permission.findOneOrFail({ where: { role_id: roleId, permission_name: nameOfPermissionToGrant } });
                    expect(gqlPermission).to.exist;
                    expect(gqlPermission).to.include({ role_id: roleId, permission_name: nameOfPermissionToGrant, allow: true });
                    expect(dbPermission).to.include(gqlPermission);
                });
            });

            context("and permission entry does not exist", () => {
                it("should return the permission with 'allow' set to true and create a database entry", async () => {
                    const gqlPermission = await grantPermission(testClient, roleId, nameOfPermissionToGrant, { authorization: BillyAuthToken });
    
                    const dbPermission = await Permission.findOneOrFail({ where: { role_id: roleId, permission_name: nameOfPermissionToGrant } });
                    expect(gqlPermission).to.exist;
                    expect(gqlPermission).to.include({ role_id: roleId, permission_name: nameOfPermissionToGrant, allow: true });
                    expect(dbPermission).to.include(gqlPermission);
                });
            });
        });

        context("when user does not have the 'edit role permissions' permission within the organization", () => {
            context("and permission entry exists with allow set to false", () => {
                beforeEach(async () => {
                    await denyPermission(testClient, roleId, nameOfPermissionToGrant, { authorization: JoeAuthToken });
                });

                it("should throw a permission exception, and not create a database entry", async () => {
                    const fn = () => grantPermission(testClient, roleId, nameOfPermissionToGrant, { authorization: BillyAuthToken });
                    expect(fn()).to.be.rejected;
    
                    const dbPermission = await Permission.findOneOrFail({ where: { role_id: roleId, permission_name: nameOfPermissionToGrant } });
                    expect(dbPermission.allow).to.equal(false);
                });
            });

            context("and permission entry does not exist", () => {
                it("should throw a permission exception, and not create a database entry", async () => {
                    const fn = () => grantPermission(testClient, roleId, nameOfPermissionToGrant, { authorization: BillyAuthToken });
                    expect(fn()).to.be.rejected;
    
                    const dbPermission = await Permission.findOne({ where: { role_id: roleId, permission_name: nameOfPermissionToGrant } });
                    expect(dbPermission).to.be.undefined;
                });
            });
        });
    });

    describe("revoke", () => {
        const nameOfPermissionToRevoke = PermissionName.view_role_permissions_30112;
        let organizationId: string;
        let userId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            roleId = (await createRole(testClient, organizationId, "My Role")).role_id;
            await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId, { authorization: JoeAuthToken });
            await grantPermission(testClient, roleId, nameOfPermissionToRevoke, { authorization: JoeAuthToken });
        });

        context("when user has the 'edit role permissions' permission within the organization", () => {
            beforeEach(async () => {
                await grantPermission(testClient, roleId, PermissionName.edit_role_permissions_30332, { authorization: JoeAuthToken });
            });

            it("should return true and delete the database entry", async () => {
                const successful = await revokePermission(testClient, roleId, nameOfPermissionToRevoke, { authorization: BillyAuthToken });

                const dbPermission = await Permission.findOne({ where: { role_id: roleId, permission_name: nameOfPermissionToRevoke } });
                expect(successful).to.be.true;
                expect(dbPermission).to.be.undefined;
            });
        });

        context("when user does not have the 'edit role permissions' permission within the organization", () => {
            it("should throw a permission exception and not delete/modify the database entry", async () => {
                const fn = () => revokePermission(testClient, roleId, nameOfPermissionToRevoke, { authorization: BillyAuthToken });
                expect(fn()).to.be.rejected;
                
                const dbPermission = await Permission.findOneOrFail({ where: { role_id: roleId, permission_name: nameOfPermissionToRevoke } });
                expect(dbPermission.allow).to.be.true;
            });
        });
    });
});