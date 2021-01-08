import { expect } from "chai";
import { Connection } from "typeorm";
import { Organization } from "../../src/entities/organization";
import { Status } from "../../src/entities/status";
import {OrganizationMembership} from "../../src/entities/organizationMembership";
import { Model } from "../../src/model";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { getSchoolMembershipsForOrganizationMembership, addRoleToOrganizationMembership, addRolesToOrganizationMembership, removeRoleToOrganizationMembership, leaveOrganization, getClassesTeachingViaOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganizationAndValidate, createSchool, createRole, createClass } from "../utils/operations/organizationOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { addOrganizationToUser, addOrganizationToUserAndValidate, createOrganizationAndValidate } from "../utils/operations/userOps";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { createTestConnection } from "../utils/testConnection";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { addRoleToSchoolMembership, schoolMembershipCheckAllowed } from "../utils/operations/schoolMembershipOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";
import { Role } from "../../src/entities/role";
import { addTeacherToClass } from "../utils/operations/classOps";
import { createUserAndValidate } from "../utils/operations/modelOps";
import { accountUUID, User } from "../../src/entities/user";

describe("organizationMembership", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let userId: string;
    let organizationId: string;
    let schoolId: string;
    let organization: Organization;
    let testSchoolRoleId: string;

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
        let organization1Id: string;
        let school1Id: string;
        let school2Id: string;
        let org1RoleId: string;
        let org2RoleId: string;
        let idOfUserToBeQueried: string;
        const tokenOfOrg1Owner = JoeAuthToken;
        const tokenOfOrg2Owner = BillyAuthToken;
        const permissionName = PermissionName.edit_groups_30330;
        const userToBeQueried = {
            user_id: accountUUID("testuser@gmail.com"),
            email: "testuser@gmail.com",
        } as User;

        beforeEach(async () => {
            const user = await createUserJoe(testClient);
            const idOfOrg1Owner = user.user_id;
            const idOfOrg2Owner = (await createUserBilly(testClient)).user_id;
            idOfUserToBeQueried = (await createUserAndValidate(testClient, userToBeQueried)).user_id;
            organization1Id = (await createOrganizationAndValidate(testClient, idOfOrg1Owner)).organization_id;
            const organization2Id = (await createOrganizationAndValidate(testClient, idOfOrg2Owner, tokenOfOrg2Owner)).organization_id;
            await addOrganizationToUserAndValidate(testClient, idOfUserToBeQueried, organization1Id, tokenOfOrg1Owner);
            await addOrganizationToUserAndValidate(testClient, idOfUserToBeQueried, organization2Id, tokenOfOrg2Owner);
            school1Id = (await createSchool(testClient, organization1Id, "School 1", { authorization: tokenOfOrg1Owner })).school_id;
            school2Id = (await createSchool(testClient, organization2Id, "School 2", { authorization: tokenOfOrg2Owner })).school_id;
            await addUserToSchool(testClient, idOfUserToBeQueried, school1Id, { authorization: tokenOfOrg1Owner });
            await addUserToSchool(testClient, idOfUserToBeQueried, school2Id, { authorization: tokenOfOrg2Owner });
            await addUserToSchool(testClient, idOfOrg1Owner, school1Id, { authorization: tokenOfOrg1Owner });
            await addUserToSchool(testClient, idOfOrg1Owner, school2Id, { authorization: tokenOfOrg2Owner });
            org1RoleId = (await createRole(testClient, organization1Id, "Org 1 Role")).role_id;
            org2RoleId = (await createRole(testClient, organization2Id, "Org 2 Role", tokenOfOrg2Owner)).role_id;
            await grantPermission(testClient, org1RoleId, permissionName, { authorization: tokenOfOrg1Owner });
            await grantPermission(testClient, org2RoleId, permissionName, { authorization: tokenOfOrg2Owner });
        });

        context("when user being queried has the specified permission in a school's organization", () => {
            beforeEach(async () =>{
                await addRoleToOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, org1RoleId, { authorization: tokenOfOrg1Owner });
            });

            it("should return an array containing one school membership", async () => {
                const gqlMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, permissionName, { authorization: tokenOfOrg1Owner });
                const isAllowed = await schoolMembershipCheckAllowed(testClient, idOfUserToBeQueried, school1Id, permissionName);
                expect(isAllowed).to.be.true;
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(1);
            });
        });

        context("when user being queried does not have the specified permission in a school's organization", () => {
            it("should return an empty array", async () => {
                const gqlMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, permissionName, { authorization: tokenOfOrg1Owner });
                const isAllowed = await schoolMembershipCheckAllowed(testClient, idOfUserToBeQueried, school1Id, permissionName);
                expect(isAllowed).to.be.false;
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(0);
            });
        });

        context("when user being queried has the specified permission in a school", () => {
            beforeEach(async () =>{
                await addRoleToSchoolMembership(testClient, idOfUserToBeQueried, school1Id, org1RoleId, { authorization: tokenOfOrg1Owner });
            });

            it("should return an array containing one school membership", async () => {
                const gqlMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, permissionName, { authorization: tokenOfOrg1Owner });
                const isAllowed = await schoolMembershipCheckAllowed(testClient, idOfUserToBeQueried, school1Id, permissionName);
                expect(isAllowed).to.be.true;
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(1);
            });
        });

        context("when user being queried does not have the specified permission in a school", () => {
            it("should return an empty array", async () => {
                const gqlMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, permissionName, { authorization: tokenOfOrg1Owner });
                const isAllowed = await schoolMembershipCheckAllowed(testClient, idOfUserToBeQueried, school1Id, permissionName);
                expect(isAllowed).to.be.false;
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(0);
            });
        });

        context("when user being queried has the specified permission in organization 1 and in school 2 of organization 2", () => {
            beforeEach(async () =>{
                await addRoleToOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, org1RoleId, { authorization: tokenOfOrg1Owner });
                await addRoleToSchoolMembership(testClient, idOfUserToBeQueried, school2Id, org2RoleId, { authorization: tokenOfOrg2Owner });
            });

            it("should return an array containing one school membership", async () => {
                const gqlMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, permissionName, { authorization: tokenOfOrg1Owner });
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(1);
                expect(gqlMemberships[0].school_id).to.equal(school1Id);
                expect(gqlMemberships[0].user_id).to.equal(idOfUserToBeQueried);
            });
        });
    });

    describe("classesTeaching", () => {
        let idOfUserToBeQueried: string;
        let idOfAnotherTeacher: string;
        let organization1Id: string;
        let organization2Id: string;
        let org1Class1Id: string;
        let org2Class1Id: string;
        let org2Class2Id: string;

        beforeEach(async () => {
            const user = await createUserJoe(testClient);
            const idOfOrg1Owner = user.user_id;
            const idOfOrg2Owner = (await createUserBilly(testClient)).user_id;
            idOfUserToBeQueried = idOfOrg1Owner;
            idOfAnotherTeacher = idOfOrg2Owner;
            organization1Id = (await createOrganizationAndValidate(testClient, idOfOrg1Owner, "Org 1", JoeAuthToken)).organization_id;
            organization2Id = (await createOrganizationAndValidate(testClient, idOfOrg2Owner, "Org 2", BillyAuthToken)).organization_id;
            await addOrganizationToUser(testClient, idOfUserToBeQueried, organization2Id, BillyAuthToken);
            org1Class1Id = (await createClass(testClient, organization1Id, "Class 1", { authorization: JoeAuthToken })).class_id;
            org2Class1Id = (await createClass(testClient, organization2Id, "Class 1", { authorization: BillyAuthToken })).class_id;
            org2Class2Id = (await createClass(testClient, organization2Id, "Class 2", { authorization: BillyAuthToken })).class_id;
        });

        context("when user being queried is a teacher for class 1 in organization 2", () => {
            beforeEach(async () =>{
                await addTeacherToClass(testClient, org2Class1Id, idOfUserToBeQueried, { authorization: BillyAuthToken });
            });

            context("and another user is a teacher for class 2 in organization 2", () => {
                beforeEach(async () =>{
                    await addTeacherToClass(testClient, org2Class2Id, idOfAnotherTeacher, { authorization: BillyAuthToken });
                });

                it("should return an empty array when querying organization 1", async () => {
                    const gqlClasses = await getClassesTeachingViaOrganizationMembership(testClient, idOfUserToBeQueried, organization1Id, { authorization: JoeAuthToken });
                    expect(gqlClasses).to.exist;
                    expect(gqlClasses).to.be.empty;
                });
    
                it("should return class 1 of organization 2 when querying organization 2", async () => {
                    const gqlClasses = await getClassesTeachingViaOrganizationMembership(testClient, idOfUserToBeQueried, organization2Id, { authorization: JoeAuthToken });
                    expect(gqlClasses).to.exist.and.have.lengthOf(1);
                    expect(gqlClasses[0].class_id).to.equal(org2Class1Id);
                });
            });
        });
    });

    describe("checkAllowed", async () => {
        // TODO: Add tests.
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

    describe("Adding role and roles", () => {
        context("fail to add role for one organization to a different organizations", () => {
            let userId: string;
            let organization1Id: string;
            let organization2Id: string;
            let school1Id: string;
            let school2Id: string;
            let org1Owner: User;
            let org2Owner: User;
            let role1: Role
            let role2: Role;

            beforeEach(async () => {
                org1Owner = await createUserJoe(testClient);
                org2Owner = await createUserBilly(testClient);
                userId = org1Owner.user_id;
                organization1Id = (await createOrganizationAndValidate(testClient, org1Owner.user_id, "org 1")).organization_id;
                organization2Id = (await createOrganizationAndValidate(testClient, org2Owner.user_id, "org 2", BillyAuthToken)).organization_id;

                school1Id = (await createSchool(testClient, organization1Id, "school 1", { authorization: JoeAuthToken })).school_id;
                school2Id = (await createSchool(testClient, organization2Id, "school 2", { authorization: BillyAuthToken })).school_id;
                await addUserToOrganizationAndValidate(testClient, org1Owner.user_id, organization1Id, { authorization: JoeAuthToken });
                await addUserToOrganizationAndValidate(testClient, org2Owner.user_id, organization2Id, { authorization: BillyAuthToken });
                role1 = await createRole(testClient, organization1Id, "student", JoeAuthToken);
                role2 = await createRole(testClient, organization2Id, "student", BillyAuthToken);

            });
            it("should succed to add the role ", async () => {
                let result = await addRoleToOrganizationMembership(testClient, org1Owner.user_id, organization1Id, role1.role_id)
                expect(result).to.exist
            });
            it("should should fail to add the role ", async () => {
                let result = await addRoleToOrganizationMembership(testClient, org1Owner.user_id, organization1Id, role2.role_id)
                expect(result).to.not.exist
            });
            it("should succed to add the roles ", async () => {
                let result = await addRolesToOrganizationMembership(testClient, org1Owner.user_id, organization1Id, [role1.role_id])
                expect(result).to.exist
            });
            it("should should fail to add the roles ", async () => {
                let result = await addRolesToOrganizationMembership(testClient, org1Owner.user_id, organization1Id, [role2.role_id])
                expect(result).to.not.exist
            });
        });
    })

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

    describe("inactivate", async () => {
        // TODO: Add tests.
    });
});
