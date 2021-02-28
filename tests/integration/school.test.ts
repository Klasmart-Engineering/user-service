import { expect, use } from "chai";
import { Connection } from "typeorm";
import { Model } from "../../src/model";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganizationAndValidate, createSchool, createRole, createClassAndValidate } from "../utils/operations/organizationOps";
import { addUserToSchool, getSchoolClasses, getSchoolMembershipsViaSchool, getSchoolMembershipViaSchool, getSchoolOrganization, updateSchool, deleteSchool } from "../utils/operations/schoolOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createTestConnection } from "../utils/testConnection";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";
import { SchoolMembership } from "../../src/entities/schoolMembership";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { Organization } from "../../src/entities/organization";
import { Class } from "../../src/entities/class";
import { School } from "../../src/entities/school";
import { accountUUID, User } from "../../src/entities/user";
import { Status } from "../../src/entities/status";
import { addSchoolToClass } from "../utils/operations/classOps";
import { createUserAndValidate } from "../utils/operations/modelOps";
import chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);

describe("school", () => {
    let connection: Connection;
    let originalAdmins: string[];
    let testClient: ApolloServerTestClient;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    describe("organization", () => {
        let organizationId: string;
        let schoolId: string;
        let school : School;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            school = await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })
            schoolId = school?.school_id;
        });

        it("the school status by default is active", async () => {
            expect(school.status).to.eq(Status.ACTIVE)
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
        let school : School;
        let schoolId: string;
        let classId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            school = await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })
            schoolId = school?.school_id;
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
        let school : School;
        let schoolId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            school = await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })
            schoolId = school?.school_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
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
        let school : School;
        let schoolId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            school = await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })
            schoolId = school?.school_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
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
        let school : School;
        let schoolId: string;
        let roleId: string;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            userId = (await createUserBilly(testClient)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            school = await createSchool(testClient, organizationId, originalSchoolName, { authorization: JoeAuthToken })
            schoolId = school?.school_id;
            await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
            await addUserToSchool(testClient, userId, schoolId, { authorization: JoeAuthToken })
            roleId = (await createRole(testClient, organizationId, "test_role")).role_id;
            await grantPermission(testClient, roleId, PermissionName.edit_school_20330, { authorization: JoeAuthToken });
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

                context("and the school is marked as inactive", () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, { authorization: JoeAuthToken });
                    });

                    it("fails edit the school", async () => {
                        const gqlSchool = await updateSchool(testClient, schoolId, newSchoolName, { authorization: BillyAuthToken });

                        const dbSchool = await School.findOneOrFail({ where: { school_id: schoolId } });
                        expect(dbSchool.school_name).to.equal(originalSchoolName);
                        expect(gqlSchool).to.be.null;
                    });
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

                context("and the school is marked as inactive", () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, { authorization: JoeAuthToken });
                    });

                    it("fails edit the school", async () => {
                        const gqlSchool = await updateSchool(testClient, schoolId, newSchoolName, { authorization: BillyAuthToken });

                        const dbSchool = await School.findOneOrFail({ where: { school_id: schoolId } });
                        expect(dbSchool.school_name).to.equal(originalSchoolName);
                        expect(gqlSchool).to.be.null;
                    });
                });
            });
        });

        context("when user does not have the edit school permission", () => {
            it("should throw a permission exception, and not update the database entry", async () => {
                const fn = () => updateSchool(testClient, schoolId, newSchoolName, { authorization: BillyAuthToken });
                expect(fn()).to.be.rejected;

                const dbSchool = await School.findOneOrFail({ where: { school_id: schoolId } });
                expect(dbSchool.school_name).to.equal(originalSchoolName);
            });
        });
    });

    describe("addUser", () => {
        let idOfUserToPerformAction: string;
        let idOfUserToBeAdded: string;
        let organizationId: string;
        let school : School;
        let schoolId: string;
        let roleId: string;
        const userToBeAdded = {
            user_id: accountUUID("testuser@gmail.com"),
            email: "testuser@gmail.com",
        } as User;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            idOfUserToPerformAction = (await createUserBilly(testClient)).user_id;
            idOfUserToBeAdded = (await createUserAndValidate(testClient, userToBeAdded)).user_id;
            organizationId = (await createOrganizationAndValidate(testClient, orgOwner.user_id, "org 1")).organization_id;
            school = await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })
            schoolId = school?.school_id;
            await addUserToOrganizationAndValidate(testClient, idOfUserToPerformAction, organizationId, { authorization: JoeAuthToken });
            await addUserToSchool(testClient, idOfUserToPerformAction, schoolId, { authorization: JoeAuthToken })
            roleId = (await createRole(testClient, organizationId, "test_role")).role_id;
            await grantPermission(testClient, roleId, PermissionName.edit_school_20330, { authorization: JoeAuthToken });
        });

        context("when user has the edit school permission", () => {
            context("within the organization", () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(testClient, idOfUserToPerformAction, organizationId, roleId);
                });

                it("should return the membership and create a database entry", async () => {
                    await addUserToOrganizationAndValidate(testClient, idOfUserToBeAdded, organizationId, { authorization: JoeAuthToken });
                    const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                    const dbMembership = await SchoolMembership.findOneOrFail({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                    expect(gqlMembership).to.exist;
                    expect(gqlMembership).to.include({ user_id: idOfUserToBeAdded, school_id: schoolId });
                    expect(dbMembership).to.include(gqlMembership);
                });

                context("and the user being added isn't a member of the organization", () => {
                    it("fails add user to the school", async () => {
                        const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                        const dbMembership = await SchoolMembership.findOne({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                        expect(dbMembership).to.be.undefined;
                        expect(gqlMembership).to.be.null;
                    });
                });

                context("and the school is marked as inactive", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, idOfUserToBeAdded, organizationId, { authorization: JoeAuthToken });
                        await deleteSchool(testClient, school.school_id, { authorization: JoeAuthToken });
                    });

                    it("fails add user to the school", async () => {
                        const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                        const dbMembership = await SchoolMembership.findOne({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                        expect(dbMembership).to.be.undefined;
                        expect(gqlMembership).to.be.null;
                    });
                });
            });

            context("within the school", () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(testClient, idOfUserToPerformAction, schoolId, roleId);
                });

                it("should return the membership and create a database entry", async () => {
                    await addUserToOrganizationAndValidate(testClient, idOfUserToBeAdded, organizationId, { authorization: JoeAuthToken });
                    const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                    const dbMembership = await SchoolMembership.findOneOrFail({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                    expect(gqlMembership).to.exist;
                    expect(gqlMembership).to.include({ user_id: idOfUserToBeAdded, school_id: schoolId });
                    expect(dbMembership).to.include(gqlMembership);
                });

                context("and the user being added isn't a member of the organization", () => {
                    it("fails add user to the school", async () => {
                        const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                        const dbMembership = await SchoolMembership.findOne({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                        expect(dbMembership).to.be.undefined;
                        expect(gqlMembership).to.be.null;
                    });
                });

                context("and the school is marked as inactive", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, idOfUserToBeAdded, organizationId, { authorization: JoeAuthToken });
                        await deleteSchool(testClient, school.school_id, { authorization: JoeAuthToken });
                    });

                    it("fails add user to the school", async () => {
                        const gqlMembership = await addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });

                        const dbMembership = await SchoolMembership.findOne({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                        expect(dbMembership).to.be.undefined;
                        expect(gqlMembership).to.be.null;
                    });
                });
            });
        });

        context("when user does not have the edit school permission", () => {
            it("should throw a permission exception, and not add a database entry", async () => {
                await addUserToOrganizationAndValidate(testClient, idOfUserToBeAdded, organizationId, { authorization: JoeAuthToken });

                const fn = () => addUserToSchool(testClient, idOfUserToBeAdded, schoolId, { authorization: BillyAuthToken });
                expect(fn()).to.be.rejected;

                const dbMembership = await SchoolMembership.findOne({ where: { user_id: idOfUserToBeAdded, school_id: schoolId } });
                expect(dbMembership).to.be.undefined;
            });
        });
    });

    describe("delete", () => {
        let school: School;
        let user: User;
        let organization : Organization;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            user = await createUserBilly(testClient);
            organization = await createOrganizationAndValidate(testClient, orgOwner.user_id);
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
            school = await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken });
            const schoolId = school?.school_id
            const cls = await createClassAndValidate(testClient, organizationId);
            const classId = cls?.class_id
            await addSchoolToClass(testClient, classId, schoolId, { authorization: JoeAuthToken });
        });

        context("when not authenticated", () => {
            it("should throw a permission exception, and not delete the database entry", async () => {
                const fn = () => deleteSchool(testClient, school.school_id, { authorization: undefined });
                expect(fn()).to.be.rejected;

                const dbSchool = await School.findOneOrFail(school.school_id);
                expect(dbSchool.status).to.eq(Status.ACTIVE);
                expect(dbSchool.deleted_at).to.be.null;
            });
        });

        context("when authenticated", () => {
            context("and the user does not have delete class permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("should throw a permission exception, and not delete the database entry", async () => {
                    const fn = () => deleteSchool(testClient, school.school_id, { authorization: BillyAuthToken });
                    expect(fn()).to.be.rejected;

                    const dbSchool = await School.findOneOrFail(school.school_id);
                    expect(dbSchool.status).to.eq(Status.ACTIVE);
                    expect(dbSchool.deleted_at).to.be.null;
                });
            });

            context("and the user has all the permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.delete_school_20440, { authorization: JoeAuthToken });
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("deletes the school", async () => {
                    const gqlSchool = await deleteSchool(testClient, school.school_id, { authorization: BillyAuthToken });
                    expect(gqlSchool).to.be.true;
                    const dbSchool = await School.findOneOrFail(school.school_id);
                    expect(dbSchool.status).to.eq(Status.INACTIVE);
                    expect(dbSchool.deleted_at).not.to.be.null;
                });

                it("deletes the school memberships", async () => {
                    const gqlSchool = await deleteSchool(testClient, school.school_id, { authorization: BillyAuthToken });
                    expect(gqlSchool).to.be.true;
                    const dbSchool = await School.findOneOrFail(school.school_id);
                    const dbSchoolMemberships = await SchoolMembership.find({ where: { school_id: school.school_id } });
                    expect(dbSchoolMemberships).to.satisfy((memberships : SchoolMembership[]) => {
                        return memberships.every(membership => membership.status === Status.INACTIVE)
                    });
                });

                it("deletes the school classes", async () => {
                    const gqlSchool = await deleteSchool(testClient, school.school_id, { authorization: BillyAuthToken });
                    expect(gqlSchool).to.be.true;
                    const dbSchool = await School.findOneOrFail(school.school_id);
                    const dbClasses = await dbSchool.classes || []

                    expect(dbClasses).to.satisfy((classes : Class[]) => {
                        return classes.every(cls => cls.status === Status.INACTIVE)
                    });
                });

                context("and the school is marked as inactive", () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, { authorization: JoeAuthToken });
                    });

                    it("fails to delete the school", async () => {
                        const gqlSchool = await deleteSchool(testClient, school.school_id, { authorization: BillyAuthToken });
                        expect(gqlSchool).to.be.null;
                        const dbSchool = await School.findOneOrFail(school.school_id);
                        expect(dbSchool.status).to.eq(Status.INACTIVE);
                        expect(dbSchool.deleted_at).not.to.be.null;
                    });
                });
            });
        });
    });
});
