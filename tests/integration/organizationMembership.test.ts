import { expect } from "chai";
import { Connection, getRepository } from "typeorm";
import { Class } from "../../src/entities/class";
import { Organization } from "../../src/entities/organization";
import { Status } from "../../src/entities/status";
import {OrganizationMembership} from "../../src/entities/organizationMembership";
import { Model } from "../../src/model";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { getSchoolMembershipsForOrganizationMembership, addRoleToOrganizationMembership, addRolesToOrganizationMembership, removeRoleToOrganizationMembership, leaveOrganization } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganizationAndValidate, createSchool, createRole } from "../utils/operations/organizationOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { createTestConnection } from "../utils/testConnection";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";
import { Context } from '../../src/main';
import { GraphQLResolveInfo } from 'graphql';

describe("organizationMembership", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let userId: string;
    let organizationId: string;
    let schoolId: string;
    let organization: Organization;
    let testSchoolRoleId: string;
    let membership: OrganizationMembership;

    let roleInfo = (role : any) => { return role.role_id }

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

    describe("schoolMemberships", () => {
        context("when user is a member of schools in different organizations", () => {
            let organization1Id: string;
            let organization2Id: string;
            let school1Id: string;
            let school2Id: string;

            beforeEach(async () => {
                const org1Owner = await createUserJoe(testClient);
                const org2Owner = await createUserBilly(testClient);
                userId = org1Owner.user_id;
                organization1Id = (await createOrganizationAndValidate(testClient, org1Owner.user_id, "org 1")).organization_id;
                organization2Id = (await createOrganizationAndValidate(testClient, org2Owner.user_id, "org 2")).organization_id;
                school1Id = (await createSchool(testClient, organization1Id, "school 1", { authorization: JoeAuthToken })).school_id;
                school2Id = (await createSchool(testClient, organization2Id, "school 2", { authorization: BillyAuthToken })).school_id;
                await addUserToOrganizationAndValidate(testClient, userId, organization1Id, { authorization: JoeAuthToken });
                await addUserToOrganizationAndValidate(testClient, userId, organization2Id, { authorization: BillyAuthToken });
                await addUserToSchool(testClient, userId, school1Id, { authorization: JoeAuthToken });
                await addUserToSchool(testClient, userId, school2Id, { authorization: BillyAuthToken });
            });

            it("should only return schools belonging to specified organization", async () => {
                const gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, userId, organization1Id);
                expect(gqlSchoolMemberships).to.have.lengthOf(1);
                expect(gqlSchoolMemberships[0].school_id).to.equal(school1Id);
            });
        });
    });

    describe("schoolMemberships with permissions", () => {
        context("when user is a member a of school with or without permissions", () => {

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                userId = orgOwner.user_id;
                organization = (await createOrganizationAndValidate(testClient, userId, "org"))
                organizationId = organization.organization_id;
                schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
                await addUserToSchool(testClient, userId, schoolId, { authorization: JoeAuthToken });
                const testSchoolRole = await createRole(testClient, organizationId, "test_role");
                testSchoolRoleId = testSchoolRole.role_id;
                await addRoleToSchoolMembership(testClient, userId, schoolId, testSchoolRoleId);
            });

            it("should return membership if has permission", async () => {
                await grantPermission(testClient, testSchoolRoleId, PermissionName.edit_class_20334, { authorization: JoeAuthToken });
                let gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, userId, organizationId, PermissionName.edit_class_20334);
                expect(gqlSchoolMemberships).to.have.lengthOf(1);
                expect(gqlSchoolMemberships[0].school_id).to.equal(schoolId);
            });
            it("should not return membership if has no permission", async () => {
                let gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, userId, organizationId, PermissionName.edit_class_20334);
                expect(gqlSchoolMemberships).to.have.lengthOf(0);
            });
        });
    });

    describe("addRole", () => {
        let roleId : string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = orgOwner.user_id;
            organization = (await createOrganizationAndValidate(testClient, userId, "org"))
            organizationId = organization.organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            const role = await createRole(testClient, organizationId);
            roleId = role?.role_id
        });

        context("when the organization membership is active", () => {
            it("adds the role to the organization membership", async () => {
                const role = await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId)
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });
                const dbRoles = await dbMembership.roles || [];

                expect(role.role_id).to.eq(roleId)
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.deep.include(roleId)
            });
        });

        context("when the organization membership is inactive", () => {
            beforeEach(async () => {
                await leaveOrganization(testClient, userId, organizationId, { authorization: BillyAuthToken });
            });

            it("does not add the role to the organization membership", async () => {
                const role = await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId)
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });
                const dbRoles = await dbMembership.roles || [];

                expect(role).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).not.to.deep.include(roleId)
                expect(dbMembership.deleted_at).to.not.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
            });
        });
    });

    describe("addRoles", () => {
        let roleId : string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = orgOwner.user_id;
            organization = (await createOrganizationAndValidate(testClient, userId, "org"))
            organizationId = organization.organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            const role = await createRole(testClient, organizationId);
            roleId = role?.role_id
        });

        context("when the organization membership is active", () => {
            it("adds the roles to the organization membership", async () => {
                const roles = await addRolesToOrganizationMembership(testClient, userId, organizationId, [roleId])
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });
                const dbRoles = await dbMembership.roles || [];

                expect(roles.map(roleInfo)).to.deep.eq([roleId])
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.deep.include(roleId)
            });
        });

        context("when the organization membership is inactive", () => {
            beforeEach(async () => {
                await leaveOrganization(testClient, userId, organizationId, { authorization: BillyAuthToken });
            });

            it("does not add the roles to the organization membership", async () => {
                const roles = await addRolesToOrganizationMembership(testClient, userId, organizationId, [roleId])
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });
                const dbRoles = await dbMembership.roles || [];

                expect(roles).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).not.to.deep.include(roleId)
                expect(dbMembership.deleted_at).to.not.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
            });
        });
    });

    describe("removeRole", () => {
        let roleId : string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = orgOwner.user_id;
            organization = (await createOrganizationAndValidate(testClient, userId, "org"))
            organizationId = organization.organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            const role = await createRole(testClient, organizationId);
            roleId = role?.role_id
            await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId)
        });

        context("when the organization membership is active", () => {
            it("removes the role to the organization membership", async () => {
                const gqlMembership = await removeRoleToOrganizationMembership(testClient, userId, organizationId, roleId)
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });
                const dbRoles = await dbMembership.roles || [];

                expect(gqlMembership.user_id).to.eq(userId)
                expect(gqlMembership.organization_id).to.eq(organizationId)
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.not.deep.include(roleId)
            });
        });

        context("when the organization membership is inactive", () => {
            beforeEach(async () => {
                await leaveOrganization(testClient, userId, organizationId, { authorization: BillyAuthToken });
            });

            it("does not remove the role to the organization membership", async () => {
                const gqlMembership = await removeRoleToOrganizationMembership(testClient, userId, organizationId, roleId)
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });
                const dbRoles = await dbMembership.roles || [];

                expect(gqlMembership).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.deep.include(roleId)
            });
        });
    });

    describe("leave", () => {
        let roleId : string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = orgOwner.user_id;
            organization = (await createOrganizationAndValidate(testClient, userId, "org"))
            organizationId = organization.organization_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            const role = await createRole(testClient, organizationId);
            roleId = role?.role_id
        });

        context("when the organization membership is active", () => {
            it("leaves the organization membership", async () => {
                const leftGql = await leaveOrganization(testClient, userId, organizationId, { authorization: BillyAuthToken });
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });

                expect(leftGql).to.be.true
                expect(dbMembership).not.to.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
                expect(dbMembership.deleted_at).not.to.be.null
            });
        });

        context("when the organization membership is inactive", () => {
            beforeEach(async () => {
                await leaveOrganization(testClient, userId, organizationId, { authorization: BillyAuthToken });
            });

            it("does not leave the organization membership", async () => {
                const leftGql = await leaveOrganization(testClient, userId, organizationId, { authorization: BillyAuthToken });
                const dbMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });

                expect(leftGql).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
                expect(dbMembership.deleted_at).not.to.be.null
            });
        });
    });
});
