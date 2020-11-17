import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class } from "../../src/entities/class";
import { addSchoolToClass, addStudentToClass, addTeacherToClass, updateClass } from "../utils/operations/classOps";
import { createOrganization } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/operations/modelOps";
import { accountUUID, User } from "../../src/entities/user";
import { createClass, createSchool } from "../utils/operations/organizationOps";
import { School } from "../../src/entities/school";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";

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

        context("when class does exist", () => {
            let cls: Class;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should update class name", async () => {
                const newClassName = "New Class Name"
                const gqlClass = await updateClass(testClient, cls.class_id, newClassName);
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
    
        context("when teacher doesn't exist", () => {
            let cls: Class;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should return null", async () => {
                const idOfUserThatDoesntExist = accountUUID();
                const teacher = await addTeacherToClass(testClient, cls.class_id, idOfUserThatDoesntExist);
                expect(teacher).to.be.null;
            });
        });

        context("when teacher does exist", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should add teacher to class", async () => {
                const teacher = await addTeacherToClass(testClient, cls.class_id, user.user_id);
                expect(teacher).to.exist;
                expect(user).to.include(teacher);
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
    
        context("when student doesn't exist", () => {
            let cls: Class;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should return null", async () => {
                const idOfUserThatDoesntExist = accountUUID();
                const student = await addStudentToClass(testClient, cls.class_id, idOfUserThatDoesntExist);
                expect(student).to.be.null;
            });
        });

        context("when student does exist", () => {
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should add student to class", async () => {
                const student = await addStudentToClass(testClient, cls.class_id, user.user_id);
                expect(user).to.include(student);
            });
        });
    });

    describe("addSchool", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });
    
        context("when school doesn't exist", () => {
            let cls: Class;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should return null", async () => {
                const idOfSchoolThatDoesntExist = accountUUID();
                const gqlSchool = await addSchoolToClass(testClient, cls.class_id, idOfSchoolThatDoesntExist);
                expect(gqlSchool).to.be.null;
            });
        });

        context("when school does exist", () => {
            let cls: Class;
            let school: School;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
                school = await createSchool(testClient, organization.organization_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should add school to class", async () => {
                const gqlSchool = await addSchoolToClass(testClient, cls.class_id, school.school_id);
                expect(school).to.include(gqlSchool);
            });
        });
    });
});