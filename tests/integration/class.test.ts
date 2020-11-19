import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class } from "../../src/entities/class";
import { addSchoolToClass, addStudentToClass, addTeacherToClass, updateClass } from "../utils/operations/classOps";
import { createOrganization } from "../utils/operations/userOps";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { User } from "../../src/entities/user";
import { addUserToOrganization, createClass, createRole, createSchool } from "../utils/operations/organizationOps";
import { School } from "../../src/entities/school";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { BillyAuthToken } from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { grantPermission } from "../utils/operations/roleOps";
import { PermissionName } from "../../src/permissions/permissionNames";

describe("class", () => {
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

    describe("set", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });
        context("when not authenticated", () => {
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                const user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                cls = await createClass(testClient, organization.organization_id);
                const editClassRole = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, editClassRole.role_id, PermissionName.edit_class_20334);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, editClassRole.role_id);
            });

            it("should fail to update class name", async () => {
                const newClassName = "New Class Name"
                const originalClassName = cls.class_name;
                const gqlClass = await updateClass(testClient, cls.class_id, newClassName, { authorization: undefined });
                expect(gqlClass).to.be.null;
                const dbClass = await Class.findOneOrFail(cls.class_id);
                expect(dbClass.class_name).to.equal(originalClassName);
            });
        });

        context("when not authorized within organization", () => {
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                const user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const emptyRole = await createRole(testClient, organization.organization_id);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, emptyRole.role_id);
            });

            it("should fail to update class name", async () => {
                const newClassName = "New Class Name"
                const originalClassName = cls.class_name;
                const gqlClass = await updateClass(testClient, cls.class_id, newClassName, { authorization: BillyAuthToken });
                expect(gqlClass).to.be.null;
                const dbClass = await Class.findOneOrFail(cls.class_id);
                expect(dbClass.class_name).to.equal(originalClassName);
            });
        });

        context("when authorized within organization", () => {
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                const user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const editClassRole = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, editClassRole.role_id, PermissionName.edit_class_20334);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, editClassRole.role_id);
            });

            it("should update class name", async () => {
                const newClassName = "New Class Name"
                const gqlClass = await updateClass(testClient, cls.class_id, newClassName, { authorization: BillyAuthToken });
                expect(gqlClass).to.exist;
                expect(gqlClass.class_name).to.equal(newClassName);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                expect(dbClass.class_name).to.equal(newClassName);
            });
        });
    });

    describe("addTeacher", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when not authenticated", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.add_teachers_to_class_20226);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
            });

            it("should fail to add teacher to class", async () => {
                const gqlTeacher = await addTeacherToClass(testClient, cls.class_id, user.user_id, { authorization: undefined });
                expect(gqlTeacher).to.be.null;
                const dbTeacher = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const teachers = await dbClass.teachers;
                const classesTeaching = await dbTeacher.classesTeaching;
                expect(classesTeaching).to.be.empty;
                expect(teachers).to.be.empty;
            });
        });

        context("when not authorized within organization", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const emptyRole = await createRole(testClient, organization.organization_id);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, emptyRole.role_id);
            });

            it("should fail to add teacher to class", async () => {
                const gqlTeacher = await addTeacherToClass(testClient, cls.class_id, user.user_id, { authorization: BillyAuthToken });
                expect(gqlTeacher).to.be.null;
                const dbTeacher = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const teachers = await dbClass.teachers;
                const classesTeaching = await dbTeacher.classesTeaching;
                expect(classesTeaching).to.be.empty;
                expect(teachers).to.be.empty;
            });
        });

        context("when authorized within organization", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.add_teachers_to_class_20226);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
            });

            it("should add teacher to class", async () => {
                const gqlTeacher = await addTeacherToClass(testClient, cls.class_id, user.user_id, { authorization: BillyAuthToken });
                expect(gqlTeacher).to.exist;
                expect(user).to.include(gqlTeacher);
                const dbTeacher = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const teachers = await dbClass.teachers;
                const classesTeaching = await dbTeacher.classesTeaching;
                expect(classesTeaching).to.have.lengthOf(1);
                expect(teachers).to.have.lengthOf(1);
                expect(classesTeaching![0].class_id).to.equal(dbClass.class_id);
                expect(teachers![0].user_id).to.equal(dbTeacher.user_id);
            });
        });
    });

    describe("addStudent", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });
    
        context("when not authenticated", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.add_students_to_class_20225);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
            });

            it("should fail to add student to class", async () => {
                const gqlStudent = await addStudentToClass(testClient, cls.class_id, user.user_id, { authorization: undefined });
                expect(gqlStudent).to.be.null;
                const dbStudent = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const students = await dbClass.students;
                const classesStudying = await dbStudent.classesStudying;
                expect(classesStudying).to.be.empty;
                expect(students).to.be.empty;
            });
        });

        context("when not authorized within organization", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const emptyRole = await createRole(testClient, organization.organization_id);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, emptyRole.role_id);
            });

            it("should fail to add student to class", async () => {
                const gqlStudent = await addStudentToClass(testClient, cls.class_id, user.user_id, { authorization: BillyAuthToken });
                expect(gqlStudent).to.be.null;
                const dbStudent = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const students = await dbClass.students;
                const classesStudying = await dbStudent.classesStudying;
                expect(classesStudying).to.be.empty;
                expect(students).to.be.empty;
            });
        });

        context("when authorized within organization", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.add_students_to_class_20225);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
            });

            it("should add student to class", async () => {
                const gqlStudent = await addStudentToClass(testClient, cls.class_id, user.user_id, { authorization: BillyAuthToken });
                expect(gqlStudent).to.exist;
                expect(user).to.include(gqlStudent);
                const dbStudent = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const students = await dbClass.students;
                const classesStudying = await dbStudent.classesStudying;
                expect(classesStudying).to.have.lengthOf(1);
                expect(students).to.have.lengthOf(1);
                expect(classesStudying![0].class_id).to.equal(dbClass.class_id);
                expect(students![0].user_id).to.equal(dbStudent.user_id);
            });
        });
    });

    describe("addSchool", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when not authenticated", () => {
            let school: School;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                const user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                school = await createSchool(testClient, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.edit_school_20330);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
            });

            it("should fail to add student to class", async () => {
                const gqlSchool = await addSchoolToClass(testClient, cls.class_id, school.school_id, { authorization: undefined });
                expect(gqlSchool).to.be.null;
                const dbSchool = await School.findOneOrFail(school.school_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const schools = await dbClass.schools;
                const classes = await dbSchool.classes;
                expect(classes).to.be.empty;
                expect(schools).to.be.empty;
            });
        });

        context("when not authorized within organization", () => {
            let school: School;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                const user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                school = await createSchool(testClient, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const emptyRole = await createRole(testClient, organization.organization_id);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, emptyRole.role_id);
            });

            it("should fail to add student to class", async () => {
                const gqlSchool = await addSchoolToClass(testClient, cls.class_id, school.school_id, { authorization: BillyAuthToken });
                expect(gqlSchool).to.be.null;
                const dbSchool = await School.findOneOrFail(school.school_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const schools = await dbClass.schools;
                const classes = await dbSchool.classes;
                expect(classes).to.be.empty;
                expect(schools).to.be.empty;
            });
        });

        context("when authorized within organization", () => {
            let school: School;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                const user = await createUserBilly(testClient);
                const organization = await createOrganization(testClient, orgOwner.user_id);
                await addUserToOrganization(testClient, user.user_id, organization.organization_id);
                school = await createSchool(testClient, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.edit_school_20330);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
            });

            it("should add student to class", async () => {
                const gqlSchool = await addSchoolToClass(testClient, cls.class_id, school.school_id, { authorization: BillyAuthToken });
                expect(gqlSchool).to.exist;
                expect(school).to.include(gqlSchool);
                const dbSchool = await School.findOneOrFail(school.school_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const schools = await dbClass.schools;
                const classes = await dbSchool.classes;
                expect(classes).to.have.lengthOf(1);
                expect(schools).to.have.lengthOf(1);
                expect(classes![0].class_id).to.equal(dbClass.class_id);
                expect(schools![0].school_id).to.equal(dbSchool.school_id);
            });
        });
    });
});