import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class } from "../../src/entities/class";
import { Status } from "../../src/entities/status";
import { addSchoolToClass, addStudentToClass, addTeacherToClass, editTeachersInClass, editStudentsInClass, editSchoolsInClass, updateClass } from "../utils/operations/classOps";
import { createOrganization } from "../utils/operations/userOps";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { Organization } from "../../src/entities/organization";
import { User } from "../../src/entities/user";
import { addUserToOrganization, createClass, createRole, createSchool } from "../utils/operations/organizationOps";
import { School } from "../../src/entities/school";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
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

            it("the class status by default is active", async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
                cls = await createClass(testClient, organization.organization_id);
                const emptyRole = await createRole(testClient, organization.organization_id);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, emptyRole.role_id);
            });

            it("the class status by default is active", async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
                cls = await createClass(testClient, organization.organization_id);
                const editClassRole = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, editClassRole.role_id, PermissionName.edit_class_20334);
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, editClassRole.role_id);
            });

            it("the class status by default is active", async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
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

    describe("editTeachers", () => {
        let user: User;
        let cls: Class;
        let organization : Organization;

        beforeEach(async () => {
            await connection.synchronize(true);

            const orgOwner = await createUserJoe(testClient);
            user = await createUserBilly(testClient);
            organization = await createOrganization(testClient, orgOwner.user_id);
            await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
            cls = await createClass(testClient, organization.organization_id);
        });

        context("when not authenticated", () => {
            it("fails to edit teachers in class", async () => {
                const gqlTeacher = await editTeachersInClass(testClient, cls.class_id, [user.user_id], { authorization: undefined });
                expect(gqlTeacher).to.be.null;
                const dbTeacher = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const teachers = await dbClass.teachers;
                const classesTeaching = await dbTeacher.classesTeaching;
                expect(classesTeaching).to.be.empty;
                expect(teachers).to.be.empty;
            });
        });

        context("when authenticated", () => {
            context("and the user does not have delete teacher permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.add_teachers_to_class_20226);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to edit teachers in class", async () => {
                    const gqlTeacher = await editTeachersInClass(testClient, cls.class_id, [user.user_id], { authorization: BillyAuthToken });
                    expect(gqlTeacher).to.be.null;
                    const dbTeacher = await User.findOneOrFail(user.user_id);
                    const dbClass = await Class.findOneOrFail(cls.class_id);
                    const teachers = await dbClass.teachers;
                    const classesTeaching = await dbTeacher.classesTeaching;
                    expect(classesTeaching).to.be.empty;
                    expect(teachers).to.be.empty;
                });
            });

            context("and the user does not have add teacher permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.delete_teacher_from_class_20446);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to edit teachers in class", async () => {
                    const gqlTeacher = await editTeachersInClass(testClient, cls.class_id, [user.user_id], { authorization: BillyAuthToken });
                    expect(gqlTeacher).to.be.null;
                    const dbTeacher = await User.findOneOrFail(user.user_id);
                    const dbClass = await Class.findOneOrFail(cls.class_id);
                    const teachers = await dbClass.teachers;
                    const classesTeaching = await dbTeacher.classesTeaching;
                    expect(classesTeaching).to.be.empty;
                    expect(teachers).to.be.empty;
                });
            });

            context("and the user has all the permissions", () => {
                let userInfo = (user : User) => {
                    return user.user_id
                }
                let classInfo = (cls : Class) => {
                    return cls.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.add_teachers_to_class_20226);
                    await grantPermission(testClient, role.role_id, PermissionName.delete_teacher_from_class_20446);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("edits teachers in class", async () => {
                    let gqlTeacher = await editTeachersInClass(testClient, cls.class_id, [user.user_id], { authorization: BillyAuthToken });
                    expect(gqlTeacher.map(userInfo)).to.deep.eq([user.user_id]);
                    let dbTeacher = await User.findOneOrFail(user.user_id);
                    let dbClass = await Class.findOneOrFail(cls.class_id);
                    let teachers = await dbClass.teachers || [];
                    let classesTeaching = await dbTeacher.classesTeaching || [];
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id]);
                    expect(classesTeaching.map(classInfo)).to.deep.eq([cls.class_id]);

                    gqlTeacher = await editTeachersInClass(testClient, cls.class_id, [], { authorization: BillyAuthToken });
                    expect(gqlTeacher).to.be.empty;
                    dbTeacher = await User.findOneOrFail(user.user_id);
                    dbClass = await Class.findOneOrFail(cls.class_id);
                    teachers = await dbClass.teachers || [];
                    classesTeaching = await dbTeacher.classesTeaching || [];
                    expect(teachers).to.be.empty
                    expect(classesTeaching).to.be.empty
                });
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
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

    describe("editStudents", () => {
        let user: User;
        let cls: Class;
        let organization : Organization;

        beforeEach(async () => {
            await connection.synchronize(true);

            const orgOwner = await createUserJoe(testClient);
            user = await createUserBilly(testClient);
            organization = await createOrganization(testClient, orgOwner.user_id);
            await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
            cls = await createClass(testClient, organization.organization_id);
        });

        context("when not authenticated", () => {
            it("fails to edit students in class", async () => {
                const gqlStudent = await editStudentsInClass(testClient, cls.class_id, [user.user_id], { authorization: undefined });
                expect(gqlStudent).to.be.null;
                const dbStudent = await User.findOneOrFail(user.user_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const students = await dbClass.students;
                const classesStudying = await dbStudent.classesStudying;
                expect(classesStudying).to.be.empty;
                expect(students).to.be.empty;
            });
        });

        context("when authenticated", () => {
            context("and the user does not have delete student permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.add_students_to_class_20225);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to edit students in class", async () => {
                    const gqlStudent = await editStudentsInClass(testClient, cls.class_id, [user.user_id], { authorization: BillyAuthToken });
                    expect(gqlStudent).to.be.null;
                    const dbStudent = await User.findOneOrFail(user.user_id);
                    const dbClass = await Class.findOneOrFail(cls.class_id);
                    const students = await dbClass.students;
                    const classesStudying = await dbStudent.classesStudying;
                    expect(classesStudying).to.be.empty;
                    expect(students).to.be.empty;
                });
            });

            context("and the user does not have add student permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.delete_student_from_class_roster_20445);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to edit students in class", async () => {
                    const gqlStudent = await editStudentsInClass(testClient, cls.class_id, [user.user_id], { authorization: BillyAuthToken });
                    expect(gqlStudent).to.be.null;
                    const dbStudent = await User.findOneOrFail(user.user_id);
                    const dbClass = await Class.findOneOrFail(cls.class_id);
                    const students = await dbClass.students;
                    const classesStudying = await dbStudent.classesStudying;
                    expect(classesStudying).to.be.empty;
                    expect(students).to.be.empty;
                });
            });

            context("and the user has all the permissions", () => {
                let userInfo = (user : User) => {
                    return user.user_id
                }
                let classInfo = (cls : Class) => {
                    return cls.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.add_students_to_class_20225);
                    await grantPermission(testClient, role.role_id, PermissionName.delete_student_from_class_roster_20445);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("edits students in class", async () => {
                    let gqlStudent = await editStudentsInClass(testClient, cls.class_id, [user.user_id], { authorization: BillyAuthToken });
                    expect(gqlStudent.map(userInfo)).to.deep.eq([user.user_id]);
                    let dbStudent = await User.findOneOrFail(user.user_id);
                    let dbClass = await Class.findOneOrFail(cls.class_id);
                    let students = await dbClass.students || [];
                    let classesStudying = await dbStudent.classesStudying || [];
                    expect(students.map(userInfo)).to.deep.eq([user.user_id]);
                    expect(classesStudying.map(classInfo)).to.deep.eq([cls.class_id]);

                    gqlStudent = await editStudentsInClass(testClient, cls.class_id, [], { authorization: BillyAuthToken });
                    expect(gqlStudent).to.be.empty;
                    dbStudent = await User.findOneOrFail(user.user_id);
                    dbClass = await Class.findOneOrFail(cls.class_id);
                    students = await dbClass.students || [];
                    classesStudying = await dbStudent.classesStudying || [];
                    expect(students).to.be.empty
                    expect(classesStudying).to.be.empty
                });
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
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

    describe("editSchools", () => {
        let school: School;
        let user: User;
        let cls: Class;
        let organization : Organization;

        beforeEach(async () => {
            await connection.synchronize(true);

            const orgOwner = await createUserJoe(testClient);
            user = await createUserBilly(testClient);
            organization = await createOrganization(testClient, orgOwner.user_id);
            await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
            cls = await createClass(testClient, organization.organization_id);
            school = await createSchool(testClient, organization.organization_id, "my school", { authorization: JoeAuthToken });
        });

        context("when not authenticated", () => {
            it("fails to edit schools in class", async () => {
                const gqlSchool = await editSchoolsInClass(testClient, cls.class_id, [school.school_id], { authorization: undefined });
                expect(gqlSchool).to.be.null;
                const dbSchool = await School.findOneOrFail(school.school_id);
                const dbClass = await Class.findOneOrFail(cls.class_id);
                const schools = await dbClass.schools;
                const classes = await dbSchool.classes;
                expect(classes).to.be.empty;
                expect(schools).to.be.empty;
            });
        });

        context("when authenticated", () => {
            context("and the user does not have edit school permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.edit_class_20334);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to edit schools in class", async () => {
                    const gqlSchool = await editSchoolsInClass(testClient, cls.class_id, [school.school_id], { authorization: BillyAuthToken });
                    expect(gqlSchool).to.be.null;
                    const dbSchool = await School.findOneOrFail(school.school_id);
                    const dbClass = await Class.findOneOrFail(cls.class_id);
                    const schools = await dbClass.schools;
                    const classes = await dbSchool.classes;
                    expect(classes).to.be.empty;
                    expect(schools).to.be.empty;
                });
            });

            context("and the user does not have edit class permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.edit_school_20330);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to edit schools in class", async () => {
                    const gqlSchool = await editSchoolsInClass(testClient, cls.class_id, [school.school_id], { authorization: BillyAuthToken });
                    expect(gqlSchool).to.be.null;
                    const dbSchool = await School.findOneOrFail(school.school_id);
                    const dbClass = await Class.findOneOrFail(cls.class_id);
                    const schools = await dbClass.schools;
                    const classes = await dbSchool.classes;
                    expect(classes).to.be.empty;
                    expect(schools).to.be.empty;
                });
            });

            context("and the user has all the permissions", () => {
                let schoolInfo = (school : School) => {
                    return school.school_id
                }
                let classInfo = (cls : Class) => {
                    return cls.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.edit_class_20334);
                    await grantPermission(testClient, role.role_id, PermissionName.edit_school_20330);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("edits schools in class", async () => {
                    let gqlSchool = await editSchoolsInClass(testClient, cls.class_id, [school.school_id], { authorization: BillyAuthToken });
                    expect(gqlSchool.map(schoolInfo)).to.deep.eq([school.school_id]);
                    let dbSchool = await School.findOneOrFail(school.school_id);
                    let dbClass = await Class.findOneOrFail(cls.class_id);
                    let schools = await dbClass.schools || [];
                    let classes = await dbSchool.classes || [];
                    expect(schools.map(schoolInfo)).to.deep.eq([school.school_id]);
                    expect(classes.map(classInfo)).to.deep.eq([cls.class_id]);

                    gqlSchool = await editSchoolsInClass(testClient, cls.class_id, [], { authorization: BillyAuthToken });
                    expect(gqlSchool).to.be.empty;
                    dbSchool = await School.findOneOrFail(school.school_id);
                    dbClass = await Class.findOneOrFail(cls.class_id);
                    schools = await dbClass.schools || [];
                    classes = await dbSchool.classes || [];
                    expect(schools).to.be.empty
                    expect(classes).to.be.empty
                });
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
                school = await createSchool(testClient, organization.organization_id, "my school", { authorization: JoeAuthToken });
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
                school = await createSchool(testClient, organization.organization_id, "my school", { authorization: JoeAuthToken });
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
                await addUserToOrganization(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
                school = await createSchool(testClient, organization.organization_id, "my school", { authorization: JoeAuthToken });
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
