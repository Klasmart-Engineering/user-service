import { expect } from "chai";
import { Connection } from "typeorm";
import { School } from "../../src/entities/school";
import { Model } from "../../src/model";
import { PermissionName } from "../../src/permissions/permissionNames";
import { UserPermissions } from "../../src/permissions/userPermissions";
import { superAdminRole } from "../../src/permissions/superAdmin";
import { checkToken } from "../../src/token";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { createNonAdminUser, createAdminUser } from "../utils/testEntities";
import { addUserToOrganizationAndValidate, createRole, createSchool } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { getNonAdminAuthToken, getAdminAuthToken } from "../utils/testConfig";
import { createTestConnection } from "../utils/testConnection";
import chaiAsPromised from "chai-as-promised"
import chai from "chai"
import { grantPermission, deleteRole } from "../utils/operations/roleOps";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
chai.use(chaiAsPromised);

describe("userPermissions", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let originalAdmins: string[];

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    describe("isAdmin", () => {
        let userPermissions: UserPermissions;
        let token

        beforeEach(async () => {
            const encodedToken = getNonAdminAuthToken();
            token = await checkToken(encodedToken) as any;
            userPermissions = new UserPermissions(token);
        });

        it("returns false", async () => {
            expect(userPermissions.isAdmin).to.be.false;
        });

        context("when user is a super admin", () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken();
                token = await checkToken(encodedToken) as any;
                userPermissions = new UserPermissions(token);
            });

            it("returns true", async () => {
                expect(userPermissions.isAdmin).to.be.true;
            });
        });
    });

    describe("rejectIfNotAllowed", () => {
        let userPermissions: UserPermissions;
        let schoolId: string;
        let organizationId: string;
        let userId: string;
        let testOrgRoleId: string
        let testSchoolRoleId: string
        let token

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient);
            const user = await createNonAdminUser(testClient);
            userId = user.user_id
            const organization = await createOrganizationAndValidate(testClient, orgOwner.user_id);
            organizationId = organization.organization_id;
            await addUserToOrganizationAndValidate(testClient, user.user_id, organizationId, { authorization: getAdminAuthToken() });
            const school = await createSchool(testClient, organizationId, "my school", undefined, { authorization: getAdminAuthToken() });
            schoolId = school.school_id;
            await addUserToSchool(testClient, userId, schoolId, { authorization: getAdminAuthToken() });
            const testOrgRole = await createRole(testClient, organizationId, "test_role");
            testOrgRoleId = testOrgRole.role_id;
            await addRoleToOrganizationMembership(testClient, userId, organizationId, testOrgRoleId);
            const testSchoolRole = await createRole(testClient, organizationId, "test_role");
            testSchoolRoleId = testSchoolRole.role_id;
            await addRoleToSchoolMembership(testClient, userId, schoolId, testSchoolRoleId);
        });

        context("when user role doesn't include specified permission", () => {
            beforeEach(async () => {
                const encodedToken = getNonAdminAuthToken();
                token = await checkToken(encodedToken) as any;
                userPermissions = new UserPermissions(token);
            });

            it("should throw error when school ID array is provided", async () => {
                const permissionContext = { school_id: undefined, school_ids: [schoolId], organization_id: undefined };
                const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                await expect(fn()).to.be.rejected;
            });

            it("should throw error when organization ID is provided", async () => {
                const permissionContext = { school_id: undefined, school_ids: undefined, organization_id: organizationId };
                const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                await expect(fn()).to.be.rejected;
            });
        });

        context("when user role does include specified permission", () => {
            beforeEach(async () => {
                const encodedToken = getNonAdminAuthToken();
                token = await checkToken(encodedToken) as any;
                userPermissions = new UserPermissions(token);
            });

            context("and the role is active", () => {
                it("should not throw error when school ID array is provided", async () => {
                    await grantPermission(testClient, testSchoolRoleId, PermissionName.edit_class_20334, { authorization: getAdminAuthToken() });
                    const permissionContext = { school_id: undefined, school_ids: [schoolId], organization_id: undefined };
                    const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                    await expect(fn()).to.be.fulfilled;
                });

                it("should not throw error when organization ID is provided", async () => {
                    await grantPermission(testClient, testOrgRoleId, PermissionName.edit_class_20334, { authorization: getAdminAuthToken() });
                    const permissionContext = { school_id: undefined, school_ids: undefined, organization_id: organizationId };
                    const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                    await expect(fn()).to.be.fulfilled;
                });

                it("should not throw error when user dosn't have organization permission, but does have permission for at least one school", async () => {
                    await grantPermission(testClient, testSchoolRoleId, PermissionName.edit_class_20334, { authorization: getAdminAuthToken() });
                    const permissionContext = { school_id: undefined, school_ids: [schoolId], organization_id: organizationId };
                    const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                    await expect(fn()).to.be.fulfilled;
                });
            });

            context("and the role is inactive", () => {
                beforeEach(async () => {
                    await grantPermission(testClient, testOrgRoleId, PermissionName.edit_class_20334, { authorization: getAdminAuthToken() });
                    await grantPermission(testClient, testSchoolRoleId, PermissionName.edit_class_20334, { authorization: getAdminAuthToken() });
                    await deleteRole(testClient, testOrgRoleId, { authorization: getAdminAuthToken() });
                    await deleteRole(testClient, testSchoolRoleId, { authorization: getAdminAuthToken() });
                });

                it("throws an error when school ID array is provided", async () => {
                    const permissionContext = { school_id: undefined, school_ids: [schoolId], organization_id: undefined };
                    const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                    await expect(fn()).to.be.rejected;
                });

                it("throws an error when organization ID is provided", async () => {
                    const permissionContext = { school_id: undefined, school_ids: undefined, organization_id: organizationId };
                    const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, PermissionName.edit_class_20334);
                    await expect(fn()).to.be.rejected;
                });
            });
        });

        context("when the user is super admin", () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken();
                token = await checkToken(encodedToken) as any;
                userPermissions = new UserPermissions(token);
            });

            let permissionContext = {};

            it("allows all the actions of a super admin", async () => {
                for( const permission of superAdminRole.permissions){
                    const fn = async () => await userPermissions.rejectIfNotAllowed(permissionContext, permission);
                    await expect(fn()).to.be.fulfilled;
                }
            });
        });
    });
});
