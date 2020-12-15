import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { User } from "../../src/entities/user";
import { OrganizationMembership } from "../../src/entities/organizationMembership";
import { createOrganizationAndValidate, getClassesStudying, getClassesTeaching, getOrganizationMembership, getOrganizationMemberships, getSchoolMembership, getSchoolMemberships, updateUser } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/testEntities";
import { createSchool, createClass } from "../utils/operations/organizationOps";
import { addStudentToClass, addTeacherToClass } from "../utils/operations/classOps";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addOrganizationToUserAndValidate } from "../utils/operations/userOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { SchoolMembership } from "../../src/entities/schoolMembership";
import { JoeAuthToken } from "../utils/testConfig";

describe("user", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let user: User;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });
    
    after(async () => {
        await connection?.close();
    });

    function reloadDatabase() {
        return connection?.synchronize(true);
    }

    describe("set", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should set the specified user properties", async () => {
            const gqlUpdatedUser = await updateUser(testClient, user, { authorization: JoeAuthToken });
            const dbUser = await User.findOneOrFail({ where: { user_id: user.user_id } });
            expect(gqlUpdatedUser).to.exist;
            expect(dbUser).to.include(gqlUpdatedUser);
        });
    });

    describe("memberships", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const gqlMemberships = await getOrganizationMemberships(testClient, user, { authorization: JoeAuthToken });
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships).to.be.empty;
            });
        });

        context("when one", () => {
            beforeEach(async () =>{
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                await addOrganizationToUserAndValidate(testClient, user.user_id, organization.organization_id);
            });

            it("should return an array containing one organization membership", async () => {
                const gqlMemberships = await getOrganizationMemberships(testClient, user, { authorization: JoeAuthToken });
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(1);
            });
        });
    });

    describe("membership", () => {
        let organizationId: string;

        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
            const organization = await createOrganizationAndValidate(testClient, user.user_id);
            organizationId = organization.organization_id;
            await addOrganizationToUserAndValidate(testClient, user.user_id, organizationId);
        });

        it("should get the organization membership associated with the specified organization ID", async () => {
            const gqlMembership = await getOrganizationMembership(testClient, user.user_id, organizationId, { authorization: JoeAuthToken });
            const dbMembership = await OrganizationMembership.findOneOrFail({
                where: {
                    user_id: user.user_id,
                    organization_id: organizationId,
                }
            });
            
            expect(gqlMembership).to.exist;
            expect(dbMembership).to.include(gqlMembership);
        });
    });

    describe("school_memberships", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const gqlMemberships = await getSchoolMemberships(testClient, user.user_id, { authorization: JoeAuthToken });
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships).to.be.empty;
            });
        });

        context("when one", () => {
            beforeEach(async () =>{
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                const school = await createSchool(testClient, organization.organization_id, "my school", { authorization: JoeAuthToken });
                await addUserToSchool(testClient, user.user_id, school.school_id, { authorization: JoeAuthToken })
            });

            it("should return an array containing one school membership", async () => {
                const gqlMemberships = await getSchoolMemberships(testClient, user.user_id, { authorization: JoeAuthToken });
                expect(gqlMemberships).to.exist;
                expect(gqlMemberships.length).to.equal(1);
            });
        });
    });

    describe("school_membership", () => {
        let schoolId: string;

        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
            const organization = await createOrganizationAndValidate(testClient, user.user_id);
            const school = await createSchool(testClient, organization.organization_id, "my school", { authorization: JoeAuthToken });
            schoolId = school.school_id;
            await addUserToSchool(testClient, user.user_id, schoolId, { authorization: JoeAuthToken });
        });

        it("should get school membership", async () => {
            const gqlMembership = await getSchoolMembership(testClient, user.user_id, schoolId, { authorization: JoeAuthToken });
            const dbMembership = await SchoolMembership.findOneOrFail({
                where: {
                    user_id: user.user_id,
                    school_id: schoolId,
                }
            });
            
            expect(gqlMembership).to.exist;
            expect(dbMembership).to.include(gqlMembership);
        });
    });

    describe("classesTeaching", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const gqlClasses = await getClassesTeaching(testClient, user.user_id, { authorization: JoeAuthToken });
                expect(gqlClasses).to.exist;
                expect(gqlClasses).to.be.empty;
            });
        });

        context("when one", async () => {
            beforeEach(async () =>{
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                const cls = await createClass(testClient, organization.organization_id);
                await addTeacherToClass(testClient, cls.class_id, user.user_id, { authorization: JoeAuthToken });
            });

            it("should return an array containing one class", async () => {
                const gqlClasses = await getClassesTeaching(testClient, user.user_id, { authorization: JoeAuthToken });
                expect(gqlClasses).to.exist;
                expect(gqlClasses).to.have.lengthOf(1);
            });
        });
    });

    describe("classesStudying", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const gqlClasses = await getClassesStudying(testClient, user.user_id, { authorization: JoeAuthToken });
                expect(gqlClasses).to.exist;
                expect(gqlClasses).to.be.empty;
            });
        });

        context("when one", () => {
            beforeEach(async () =>{
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                const cls = await createClass(testClient, organization.organization_id);
                await addStudentToClass(testClient, cls.class_id, user.user_id, { authorization: JoeAuthToken });
            });

            it("should return an array containing one class", async () => {
                const gqlClasses = await getClassesStudying(testClient, user.user_id, { authorization: JoeAuthToken });
                expect(gqlClasses).to.exist;
                expect(gqlClasses).to.have.lengthOf(1);
            });
        });
    });

    describe("createOrganization", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should create an organization", async () => {
            const organization = await createOrganizationAndValidate(testClient, user.user_id);
            expect(organization).to.exist;
        });
    });

    describe("addOrganization", () => {
        let organizationId: string;

        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
            const organization = await createOrganizationAndValidate(testClient, user.user_id);
            organizationId = organization.organization_id;
        });

        it("user should join the specified organization", async () => {
            const membership = await addOrganizationToUserAndValidate(testClient, user.user_id, organizationId);
            expect(membership).to.exist;
        });
    });
});