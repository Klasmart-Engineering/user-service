import { expect } from "chai";
import { Connection } from "typeorm";
import { Model } from "../../src/model";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganization, createSchool, createRole, createClassAndValidate } from "../utils/operations/organizationOps";
import { addUserToSchool, getSchoolClasses, getSchoolMembershipsViaSchool, getSchoolMembershipViaSchool, getSchoolOrganization, updateSchool } from "../utils/operations/schoolOps";
import { createOrganization } from "../utils/operations/userOps";
import { createTestConnection } from "../utils/testConnection";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";
import { SchoolMembership } from "../../src/entities/schoolMembership";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { School } from "../../src/entities/school";
import { addSchoolToClass } from "../utils/operations/classOps";

describe("school", () => {
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

    describe("organization", () => {
        let organizationId: string;
        let schoolId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            organizationId = (await createOrganization(testClient, orgOwner.user_id, "org 1")).organization_id;
            schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
        });

        context("no permissions required", () => {
            it("should return the organization", async () => {
                const gqlOrganization = await getSchoolOrganization(testClient, schoolId, { authorization: BillyAuthToken });

                expect(gqlOrganization).to.exist;
                expect(gqlOrganization).to.include({ organization_id: organizationId });
            });
        });
    });

    describe("classes", () => {
        let organizationId: string;
        let schoolId: string;
        let classId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            organizationId = (await createOrganization(testClient, orgOwner.user_id, "org 1")).organization_id;
            schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
            classId = (await createClassAndValidate(testClient, organizationId)).class_id;
            await addSchoolToClass(testClient, classId, schoolId, { authorization: JoeAuthToken });
        });

        context("no permissions required", () => {
            it("should return all classes", async () => {
                const gqlClasses = await getSchoolClasses(testClient, schoolId, { authorization: BillyAuthToken });

                expect(gqlClasses).to.exist.with.lengthOf(1);
                expect(gqlClasses[0]).to.include({ class_id: classId });
            });
        });
    });

    describe("memberships", () => {
        let userId: string;
        let organizationId: string;
        let schoolId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganization(testClient, orgOwner.user_id, "org 1")).organization_id;
            schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
            // TODO: Doing this test, I found that currently, the "addee" isn't required to be part
            // of the organization in order to be added to a school. PJ said this isn't desirable.
            //await addUserToOrganization(testClient, userId, organizationId, { authorization: JoeAuthToken });
            await addUserToSchool(testClient, userId, schoolId, { authorization: JoeAuthToken })
        });

        context("no permissions required", () => {
            it("should return all memberships", async () => {
                const gqlMemberships = await getSchoolMembershipsViaSchool(testClient, schoolId, { authorization: BillyAuthToken });

                expect(gqlMemberships).to.exist;
                expect(gqlMemberships).to.have.lengthOf(1);
                expect(gqlMemberships[0]).to.include({ user_id: userId, school_id: schoolId });
            });
        });
    });

    describe("membership", () => {
        let userId: string;
        let organizationId: string;
        let schoolId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganization(testClient, orgOwner.user_id, "org 1")).organization_id;
            schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
            await addUserToOrganization(testClient, userId, organizationId, { authorization: JoeAuthToken });
            await addUserToSchool(testClient, userId, schoolId, { authorization: JoeAuthToken })
        });

        context("no permissions required", () => {
            it("should return the membership", async () => {
                const gqlMembership = await getSchoolMembershipViaSchool(testClient, schoolId, userId, { authorization: BillyAuthToken });

                expect(gqlMembership).to.exist;
                expect(gqlMembership).to.include({ user_id: userId, school_id: schoolId });
            });
        });
    });

    describe("set", () => {
        const originalSchoolName = "Old School";
        const newSchoolName = "New School";
        let userId: string;
        let organizationId: string;
        let schoolId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganization(testClient, orgOwner.user_id, "org 1")).organization_id;
            schoolId = (await createSchool(testClient, organizationId, originalSchoolName, { authorization: JoeAuthToken })).school_id;
            await addUserToOrganization(testClient, userId, organizationId, { authorization: JoeAuthToken });
            await addUserToSchool(testClient, userId, schoolId, { authorization: JoeAuthToken })
            roleId = (await createRole(testClient, organizationId, "test_role")).role_id;
            await grantPermission(testClient, roleId, PermissionName.edit_school_20330);
        });

        context("when user has the edit school permission", () => {
            context("within the organization", () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(testClient, userId, organizationId, roleId);
                });
                
                it("should return the modified school and update the database entry", async () => {
                    const gqlSchool = await updateSchool(testClient, schoolId, newSchoolName, { authorization: BillyAuthToken });
    
                    const dbSchool = await School.findOneOrFail({ where: { school_id: schoolId } });
                    expect(gqlSchool).to.exist;
                    expect(gqlSchool).to.include({ school_id: schoolId, school_name: newSchoolName });
                    expect(dbSchool).to.include(gqlSchool);
                });
            });

            context("within the school", () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(testClient, userId, schoolId, roleId);
                });
                
                it("should return the modified school and update the database entry", async () => {
                    const gqlSchool = await updateSchool(testClient, schoolId, newSchoolName, { authorization: BillyAuthToken });
    
                    const dbSchool = await School.findOneOrFail({ where: { school_id: schoolId } });
                    expect(gqlSchool).to.exist;
                    expect(gqlSchool).to.include({ school_id: schoolId, school_name: newSchoolName });
                    expect(dbSchool).to.include(gqlSchool);
                });
            });
        });

        context("when user does not have the edit school permission", () => {
            it("should return a null response, and not update the database entry", async () => {
                const gqlSchool = await updateSchool(testClient, schoolId, newSchoolName, { authorization: BillyAuthToken });

                const dbSchool = await School.findOneOrFail({ where: { school_id: schoolId } });
                expect(dbSchool.school_name).to.equal(originalSchoolName);
                expect(gqlSchool).to.be.null;
            });
        });
    });

    describe("addUser", () => {
        let idOfUserToPerformAction: string;
        let idOfUserToBeAdded: string;
        let organizationId: string;
        let schoolId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            idOfUserToPerformAction = (await createUserBilly(testClient)).user_id;
            idOfUserToBeAdded = orgOwner.user_id;
            organizationId = (await createOrganization(testClient, orgOwner.user_id, "org 1")).organization_id;
            schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
            await addUserToOrganization(testClient, idOfUserToPerformAction, organizationId, { authorization: JoeAuthToken });
            await addUserToSchool(testClient, idOfUserToPerformAction, schoolId, { authorization: JoeAuthToken })
            roleId = (await createRole(testClient, organizationId, "test_role")).role_id;
            await grantPermission(testClient, roleId, PermissionName.edit_school_20330);
        });

        context("when user has the edit school permission", () => {
            context("within the organization", () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(testClient, idOfUserToPerformAction, organizationId, roleId);
                });
                
                it("should return the membership and create a database entry", async () => {
                    const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });
    
                    const dbMembership = await SchoolMembership.findOneOrFail({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                    expect(gqlMembership).to.exist;
                    expect(gqlMembership).to.include({ user_id: idOfUserToBeAdded, school_id: schoolId });
                    expect(dbMembership).to.include(gqlMembership);
                });
            });

            context("within the school", () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(testClient, idOfUserToPerformAction, schoolId, roleId);
                });
                
                it("should return the membership and create a database entry", async () => {
                    const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });
    
                    const dbMembership = await SchoolMembership.findOneOrFail({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                    expect(gqlMembership).to.exist;
                    expect(gqlMembership).to.include({ user_id: idOfUserToBeAdded, school_id: schoolId });
                    expect(dbMembership).to.include(gqlMembership);
                });
            });
        });

        context("when user does not have the edit school permission", () => {
            it("should return a null response, and not add a database entry", async () => {
                const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                const dbMembership = await SchoolMembership.findOne({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                expect(dbMembership).to.be.undefined;
                expect(gqlMembership).to.be.null;
            });
        });
    });
});
