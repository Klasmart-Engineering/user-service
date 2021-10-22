import { expect, use } from 'chai'
import { getManager, In } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { AgeRange } from '../../src/entities/ageRange'
import { Grade } from '../../src/entities/grade'
import { Class } from '../../src/entities/class'
import { Subject } from '../../src/entities/subject'
import { Status } from '../../src/entities/status'
import {
    addSchoolToClass,
    addStudentToClass,
    addTeacherToClass,
    editTeachersInClass,
    editStudentsInClass,
    editSchoolsInClass,
    editAgeRanges,
    editGrades,
    editSubjects,
    editPrograms,
    updateClass,
    deleteClass,
    listPrograms,
    listAgeRanges,
    listGrades,
    listSubjects,
    removeTeacherInClass,
    removeSchoolFromClass,
    removeStudentInClass,
    eligibleTeachers,
    eligibleStudents,
} from '../utils/operations/classOps'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import { Organization } from '../../src/entities/organization'
import { Program } from '../../src/entities/program'
import { User } from '../../src/entities/user'
import { deleteClasses as deleteClassesResolver } from '../../src/resolvers/class'
import {
    addUserToOrganizationAndValidate,
    createClass,
    createRole,
    createSchool,
} from '../utils/operations/organizationOps'
import { School } from '../../src/entities/school'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import {
    getNonAdminAuthToken,
    getAdminAuthToken,
    generateToken,
} from '../utils/testConfig'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import { denyPermission, grantPermission } from '../utils/operations/roleOps'
import { PermissionName } from '../../src/permissions/permissionNames'
import chaiAsPromised from 'chai-as-promised'
import { addRoleToSchoolMembership } from '../utils/operations/schoolMembershipOps'
import { addUserToSchool } from '../utils/operations/schoolOps'
import { createUserAndValidate } from '../utils/operations/modelOps'
import { createOrganization } from '../factories/organization.factory'
import {
    createUser,
    createAdminUser as adminUserFactory,
} from '../factories/user.factory'
import {
    createClass as createClassFactory,
    createClasses,
} from '../factories/class.factory'
import { createRole as createRoleFactory } from '../factories/role.factory'
import { createAgeRange } from '../factories/ageRange.factory'
import { createGrade } from '../factories/grade.factory'
import { createSubject } from '../factories/subject.factory'
import { createProgram } from '../factories/program.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { Role } from '../../src/entities/role'
import { DeleteClassInput } from '../../src/types/graphQL/class'
import { expectAPIError } from '../utils/apiError'
import { customErrors } from '../../src/types/errors/customError'
import { formatMessage } from '../../src/types/errors/apiError'
import { errorFormattingWrapper } from '../utils/errors'
import { UserPermissions } from '../../src/permissions/userPermissions'

use(chaiAsPromised)

describe('class', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('set', () => {
        context('when not authenticated', () => {
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const editClassRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    editClassRole.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    editClassRole.role_id
                )
            })

            it('the class status by default is active', async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            it('should throw a permission exception and not mutate the database entry', async () => {
                const newClassName = 'New Class Name'
                const originalClassName = cls.class_name
                await expect(
                    updateClass(testClient, cls.class_id, newClassName, {
                        authorization: undefined,
                    })
                ).to.be.rejected
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.class_name).to.equal(originalClassName)
            })
        })

        context('when not authorized within organization', () => {
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('the class status by default is active', async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            it('should throw a permission exception and not mutate the database entry', async () => {
                const newClassName = 'New Class Name'
                const originalClassName = cls.class_name
                await expect(
                    updateClass(testClient, cls.class_id, newClassName, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.class_name).to.equal(originalClassName)
            })
        })

        context('when authorized within organization', () => {
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const editClassRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    editClassRole.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    editClassRole.role_id
                )
            })

            it('the class status by default is active', async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            it('should update class name', async () => {
                const newClassName = 'New Class Name'
                const gqlClass = await updateClass(
                    testClient,
                    cls.class_id,
                    newClassName,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlClass).to.exist
                expect(gqlClass.class_name).to.equal(newClassName)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.class_name).to.equal(newClassName)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not update the class name', async () => {
                    const newClassName = 'New Class Name'
                    const originalClassName = cls.class_name
                    const gqlClass = await updateClass(
                        testClient,
                        cls.class_id,
                        newClassName,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlClass).to.be.null
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    expect(dbClass.class_name).to.equal(originalClassName)
                })
            })
        })
    })

    describe('eligibleTeachers', () => {
        context(
            'when one user is authorized to attend a live class as a teacher, and another as a student',
            () => {
                let teacherId: string
                let studentId: string
                let teacherRoleId: string
                let studentRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const teacherInfo = { email: 'teacher@gmail.com' } as User
                    const studentInfo = { email: 'student@gmail.com' } as User
                    teacherId = (
                        await createUserAndValidate(testClient, teacherInfo)
                    )?.user_id
                    studentId = (
                        await createUserAndValidate(testClient, studentInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teacherId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        studentId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    teacherRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Teacher Role'
                        )
                    )?.role_id
                    studentRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Student Role'
                        )
                    )?.role_id
                    await grantPermission(
                        testClient,
                        teacherRoleId,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        { authorization: orgOwnerToken }
                    )
                    await grantPermission(
                        testClient,
                        studentRoleId,
                        PermissionName.attend_live_class_as_a_student_187,
                        { authorization: orgOwnerToken }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        teacherId,
                        organizationId,
                        teacherRoleId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        studentId,
                        organizationId,
                        studentRoleId
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            teacherId,
                            organizationId,
                            teacherRoleId
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            studentId,
                            organizationId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing the teacher', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(teacherId)
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, teacherId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addUserToSchool(testClient, studentId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            teacherId,
                            schoolId,
                            teacherRoleId
                        )
                        await addRoleToSchoolMembership(
                            testClient,
                            studentId,
                            schoolId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing the teacher', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(teacherId)
                    })
                })
            }
        )

        context(
            "when a user's permission to attend a live class as a teacher has been denied (permission.allow = false)",
            () => {
                let teacherId: string
                let teacherRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const teacherInfo = { email: 'teacher@gmail.com' } as User
                    teacherId = (
                        await createUserAndValidate(testClient, teacherInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teacherId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    teacherRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Teacher Role'
                        )
                    )?.role_id
                    await denyPermission(
                        testClient,
                        teacherRoleId,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        { authorization: orgOwnerToken }
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            teacherId,
                            organizationId,
                            teacherRoleId
                        )
                    })

                    it('returns an array containing only the organization owner', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, teacherId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            teacherId,
                            schoolId,
                            teacherRoleId
                        )
                    })

                    it('returns an array containing only the organization owner', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })
            }
        )
    })

    describe('eligibleStudents', () => {
        context(
            'when one user is authorized to attend a live class as a teacher, and another as a student',
            () => {
                let teacherId: string
                let studentId: string
                let teacherRoleId: string
                let studentRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const teacherInfo = { email: 'teacher@gmail.com' } as User
                    const studentInfo = { email: 'student@gmail.com' } as User
                    teacherId = (
                        await createUserAndValidate(testClient, teacherInfo)
                    )?.user_id
                    studentId = (
                        await createUserAndValidate(testClient, studentInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teacherId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        studentId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    teacherRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Teacher Role'
                        )
                    )?.role_id
                    studentRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Student Role'
                        )
                    )?.role_id
                    await grantPermission(
                        testClient,
                        teacherRoleId,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        { authorization: orgOwnerToken }
                    )
                    await grantPermission(
                        testClient,
                        studentRoleId,
                        PermissionName.attend_live_class_as_a_student_187,
                        { authorization: orgOwnerToken }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        teacherId,
                        organizationId,
                        teacherRoleId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        studentId,
                        organizationId,
                        studentRoleId
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            teacherId,
                            organizationId,
                            teacherRoleId
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            studentId,
                            organizationId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing only the student', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(studentId)
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, teacherId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addUserToSchool(testClient, studentId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            teacherId,
                            schoolId,
                            teacherRoleId
                        )
                        await addRoleToSchoolMembership(
                            testClient,
                            studentId,
                            schoolId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing the organization owner and the student', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(studentId)
                    })
                })
            }
        )

        context(
            "when a user's permission to attend a live class as a student has been denied (permission.allow = false)",
            () => {
                let studentId: string
                let studentRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const studentInfo = { email: 'student@gmail.com' } as User
                    studentId = (
                        await createUserAndValidate(testClient, studentInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        studentId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    studentRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Student Role'
                        )
                    )?.role_id
                    await denyPermission(
                        testClient,
                        studentRoleId,
                        PermissionName.attend_live_class_as_a_student_187,
                        { authorization: orgOwnerToken }
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            studentId,
                            organizationId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing only the organization owner', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, studentId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            studentId,
                            schoolId,
                            studentRoleId
                        )
                    })

                    it('returns an empty array', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })
            }
        )
        context('when an org has multiple schools', () => {
            let org: Organization
            let schools: School[] = []
            let students: User[] = []
            let teachers: User[] = []
            let class1: Class
            let studentRole: Role
            let teacherRole: Role
            let arbitraryUserToken: string

            beforeEach(async () => {
                await createNonAdminUser(testClient)
                arbitraryUserToken = getNonAdminAuthToken()
                schools = []
                students = []
                teachers = []
                const orgOwner = await createAdminUser(testClient)
                org = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                class1 = (await createClass(
                    testClient,
                    org.organization_id
                )) as Class

                studentRole = await createRole(
                    testClient,
                    org.organization_id,
                    'Student Role'
                )
                await grantPermission(
                    testClient,
                    studentRole.role_id,
                    PermissionName.attend_live_class_as_a_student_187,
                    { authorization: getAdminAuthToken() }
                )

                teacherRole = await createRole(
                    testClient,
                    org.organization_id,
                    'Student Role'
                )
                await grantPermission(
                    testClient,
                    teacherRole.role_id,
                    PermissionName.attend_live_class_as_a_teacher_186,
                    { authorization: getAdminAuthToken() }
                )

                for (let i = 0; i < 2; i++) {
                    schools.push(
                        await createSchool(
                            testClient,
                            org.organization_id,
                            `School ${i}`,
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    )
                    students.push(
                        await createUserAndValidate(testClient, {
                            email: `student${i}@school.com`,
                        } as User)
                    )
                    teachers.push(
                        await createUserAndValidate(testClient, {
                            email: `teacher${i}@school.com`,
                        } as User)
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        students[i].user_id,
                        org.organization_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teachers[i].user_id,
                        org.organization_id,
                        { authorization: getAdminAuthToken() }
                    )

                    await addRoleToOrganizationMembership(
                        testClient,
                        students[i].user_id,
                        org.organization_id,
                        studentRole.role_id
                    )

                    await addRoleToOrganizationMembership(
                        testClient,
                        teachers[i].user_id,
                        org.organization_id,
                        teacherRole.role_id
                    )

                    await addUserToSchool(
                        testClient,
                        students[i].user_id,
                        schools[i].school_id,
                        {
                            authorization: getAdminAuthToken(),
                        }
                    )

                    await addUserToSchool(
                        testClient,
                        teachers[i].user_id,
                        schools[i].school_id,
                        {
                            authorization: getAdminAuthToken(),
                        }
                    )

                    await addRoleToSchoolMembership(
                        testClient,
                        students[i].user_id,
                        schools[i].school_id,
                        studentRole.role_id
                    )

                    await addRoleToSchoolMembership(
                        testClient,
                        teachers[i].user_id,
                        schools[i].school_id,
                        teacherRole.role_id
                    )
                }
            })

            it('returns all org students if the class has not been assigned to a school', async () => {
                const gqlStudents = await eligibleStudents(
                    testClient,
                    class1.class_id,
                    { authorization: arbitraryUserToken }
                )
                expect(gqlStudents.length).to.eq(2)
            })

            it('returns all org teachers if the class has not been assigned to a school', async () => {
                const gqlStudents = await eligibleTeachers(
                    testClient,
                    class1.class_id,
                    { authorization: arbitraryUserToken }
                )
                expect(gqlStudents.length).to.eq(3) // 2 teachers, 1 org admin
            })

            it('only returns students from the schools that the class has been added to', async () => {
                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[0].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                let gqlStudents = await eligibleStudents(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlStudents.length).to.eq(1)

                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[1].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                gqlStudents = await eligibleStudents(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlStudents.length).to.eq(2)
            })

            it('only returns teachers from the schools that the class has been added to', async () => {
                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[0].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                let gqlTeachers = await eligibleTeachers(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlTeachers.length).to.eq(2) // 1 teacher, 1 org admin

                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[1].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                gqlTeachers = await eligibleTeachers(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlTeachers.length).to.eq(3) // 2 teachers, 1 org admin
            })
        })
    })

    describe('editTeachers', () => {
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    editTeachersInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.be.empty
                expect(teachers).to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete teacher permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.add_teachers_to_class_20226,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editTeachersInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbTeacher = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const teachers = await dbClass.teachers
                        const classesTeaching = await dbTeacher.classesTeaching
                        expect(classesTeaching).to.be.empty
                        expect(teachers).to.be.empty
                    })
                }
            )

            context(
                'and the user does not have add teacher permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.delete_teacher_from_class_20446,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editTeachersInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbTeacher = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const teachers = await dbClass.teachers
                        const classesTeaching = await dbTeacher.classesTeaching
                        expect(classesTeaching).to.be.empty
                        expect(teachers).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                const userInfo = (u: User) => {
                    return u.user_id
                }
                const classInfo = (c: Class) => {
                    return c.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.add_teachers_to_class_20226,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_teacher_from_class_20446,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('edits teachers in class', async () => {
                    let gqlTeacher = await editTeachersInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlTeacher.map(userInfo)).to.deep.eq([user.user_id])
                    let dbTeacher = await User.findOneOrFail(user.user_id)
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let teachers = (await dbClass.teachers) || []
                    let classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])

                    gqlTeacher = await editTeachersInClass(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlTeacher).to.be.empty
                    dbTeacher = await User.findOneOrFail(user.user_id)
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    teachers = (await dbClass.teachers) || []
                    classesTeaching = (await dbTeacher.classesTeaching) || []
                    expect(teachers).to.be.empty
                    expect(classesTeaching).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the teachers in class', async () => {
                        const gqlTeacher = await editTeachersInClass(
                            testClient,
                            cls.class_id,
                            [user.user_id],
                            { authorization: getNonAdminAuthToken() }
                        )

                        expect(gqlTeacher).to.be.null
                        const dbTeacher = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const teachers = await dbClass.teachers
                        const classesTeaching = await dbTeacher.classesTeaching
                        expect(classesTeaching).to.be.empty
                        expect(teachers).to.be.empty
                    })
                })
            })
        })
    })

    describe('addTeacher', () => {
        context('when not authenticated', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_teachers_to_class_20226,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addTeacherToClass(testClient, cls.class_id, user.user_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.be.empty
                expect(teachers).to.be.empty
            })
        })

        context('when not authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addTeacherToClass(testClient, cls.class_id, user.user_id, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.be.empty
                expect(teachers).to.be.empty
            })
        })

        context('when authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_teachers_to_class_20226,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should add teacher to class', async () => {
                const gqlTeacher = await addTeacherToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlTeacher).to.exist
                expect(user).to.include(gqlTeacher)
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.have.lengthOf(1)
                expect(teachers).to.have.lengthOf(1)
                expect(classesTeaching![0].class_id).to.equal(dbClass.class_id)
                expect(teachers![0].user_id).to.equal(dbTeacher.user_id)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not add the teacher in class', async () => {
                    const gqlTeacher = await addTeacherToClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbTeacher = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const teachers = await dbClass.teachers
                    const classesTeaching = await dbTeacher.classesTeaching
                    expect(classesTeaching).to.be.empty
                    expect(teachers).to.be.empty
                })
            })
        })
    })

    describe('removeTeacher', () => {
        const userInfo = (user: User) => {
            return user.user_id
        }
        const classInfo = (cls: Class) => {
            return cls.class_id
        }

        context(
            'when not authorized within the organization or any school the class belongs to',
            () => {
                let user: User
                let cls: Class

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    user = await createNonAdminUser(testClient)
                    const organization = await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        { authorization: getAdminAuthToken() }
                    )
                    cls = await createClass(
                        testClient,
                        organization.organization_id
                    )
                    const emptyRole = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        emptyRole.role_id
                    )
                    await addTeacherToClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        removeTeacherInClass(
                            testClient,
                            cls.class_id,
                            user.user_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected
                    const dbTeacher = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])
                })
            }
        )

        context('when authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_teacher_from_class_20446,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
                await addTeacherToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('removes the teacher from class', async () => {
                const gqlTeacher = await removeTeacherInClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlTeacher).to.be.true
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = (await dbClass.teachers) || []
                const classesTeaching = (await dbTeacher.classesTeaching) || []
                expect(teachers).to.be.empty
                expect(classesTeaching).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove teacher in class', async () => {
                    const gqlTeacher = await removeTeacherInClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlTeacher).to.be.null
                    const dbTeacher = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])
                })
            })
        })

        context('when authorized within a school', () => {
            let userId: string
            let classId: string
            let organizationId: string
            let schoolId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_teacher_from_class_20446,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    role.role_id
                )
                await addTeacherToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the teacher from class', async () => {
                const gqlTeacher = await removeTeacherInClass(
                    testClient,
                    classId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlTeacher).to.be.true
                const dbTeacher = await User.findOneOrFail(userId)
                const dbClass = await Class.findOneOrFail(classId)
                const teachers = (await dbClass.teachers) || []
                const classesTeaching = (await dbTeacher.classesTeaching) || []
                expect(teachers).to.be.empty
                expect(classesTeaching).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove teacher in class', async () => {
                    const gqlTeacher = await removeTeacherInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbTeacher = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([userId])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([classId])
                })
            })

            context('and the teacher has other assigned school', async () => {
                let otherClassId: string

                beforeEach(async () => {
                    otherClassId = (
                        await createClass(
                            testClient,
                            organizationId,
                            'Other Class'
                        )
                    )?.class_id

                    await addSchoolToClass(testClient, otherClassId, schoolId, {
                        authorization: getAdminAuthToken(),
                    })

                    await addTeacherToClass(testClient, otherClassId, userId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('should have the other class assigned', async () => {
                    const gqlTeacher = await removeTeacherInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.true
                    const dbTeacher = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    const classIds = classesTeaching.map(
                        ({ class_id }) => class_id
                    )

                    expect(teachers).to.be.empty
                    expect(classesTeaching.length).eq(1)
                    expect(classIds).to.deep.eq([otherClassId])
                })
            })
        })
    })

    describe('editStudents', () => {
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    editStudentsInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.be.empty
                expect(students).to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete student permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.add_students_to_class_20225,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editStudentsInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbStudent = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const students = await dbClass.students
                        const classesStudying = await dbStudent.classesStudying
                        expect(classesStudying).to.be.empty
                        expect(students).to.be.empty
                    })
                }
            )

            context(
                'and the user does not have add student permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.delete_student_from_class_roster_20445,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editStudentsInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbStudent = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const students = await dbClass.students
                        const classesStudying = await dbStudent.classesStudying
                        expect(classesStudying).to.be.empty
                        expect(students).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                const userInfo = (u: User) => {
                    return u.user_id
                }
                const classInfo = (c: Class) => {
                    return c.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.add_students_to_class_20225,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_student_from_class_roster_20445,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('edits students in class', async () => {
                    let gqlStudent = await editStudentsInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent.map(userInfo)).to.deep.eq([user.user_id])
                    let dbStudent = await User.findOneOrFail(user.user_id)
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let students = (await dbClass.students) || []
                    let classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesStudying.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])

                    gqlStudent = await editStudentsInClass(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.empty
                    dbStudent = await User.findOneOrFail(user.user_id)
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    students = (await dbClass.students) || []
                    classesStudying = (await dbStudent.classesStudying) || []
                    expect(students).to.be.empty
                    expect(classesStudying).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the students in class', async () => {
                        const gqlStudent = await editStudentsInClass(
                            testClient,
                            cls.class_id,
                            [user.user_id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlStudent).to.be.null
                        const dbStudent = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const students = await dbClass.students
                        const classesStudying = await dbStudent.classesStudying
                        expect(classesStudying).to.be.empty
                        expect(students).to.be.empty
                    })
                })
            })
        })
    })

    describe('addStudent', () => {
        context('when not authenticated', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_students_to_class_20225,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addStudentToClass(testClient, cls.class_id, user.user_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.be.empty
                expect(students).to.be.empty
            })
        })

        context('when not authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addStudentToClass(testClient, cls.class_id, user.user_id, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.be.empty
                expect(students).to.be.empty
            })
        })

        context('when authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_students_to_class_20225,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should add student to class', async () => {
                const gqlStudent = await addStudentToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlStudent).to.exist
                expect(user).to.include(gqlStudent)
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.have.lengthOf(1)
                expect(students).to.have.lengthOf(1)
                expect(classesStudying![0].class_id).to.equal(dbClass.class_id)
                expect(students![0].user_id).to.equal(dbStudent.user_id)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not add the student to class', async () => {
                    const gqlStudent = await addStudentToClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.null
                    const dbStudent = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const students = await dbClass.students
                    const classesStudying = await dbStudent.classesStudying
                    expect(classesStudying).to.be.empty
                    expect(students).to.be.empty
                })
            })
        })
    })

    describe('removeStudent', () => {
        const userInfo = (user: User) => {
            return user.user_id
        }
        const classInfo = (cls: Class) => {
            return cls.class_id
        }

        context(
            'when not authorized within the organization or any school the class belongs to',
            () => {
                let userId: string
                let classId: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    userId = (await createNonAdminUser(testClient))?.user_id
                    const organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwner.user_id
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        userId,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    const emptyRole = await createRole(
                        testClient,
                        organizationId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        emptyRole.role_id
                    )
                    await addStudentToClass(testClient, classId, userId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        removeStudentInClass(testClient, classId, userId, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                    const dbStudent = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([userId])
                    expect(classesStudying.map(classInfo)).to.deep.eq([classId])
                })
            }
        )

        context('when authorized within organization', () => {
            let userId: string
            let classId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                const organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_student_from_class_roster_20445,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    userId,
                    organizationId,
                    role.role_id
                )
                await addStudentToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the student from class', async () => {
                const gqlStudent = await removeStudentInClass(
                    testClient,
                    classId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlStudent).to.be.true
                const dbStudent = await User.findOneOrFail(userId)
                const dbClass = await Class.findOneOrFail(classId)
                const students = (await dbClass.students) || []
                const classesStudying = (await dbStudent.classesStudying) || []
                expect(students).to.be.empty
                expect(classesStudying).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove student from class', async () => {
                    const gqlStudent = await removeStudentInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.null
                    const dbStudents = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudents.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([userId])
                    expect(classesStudying.map(classInfo)).to.deep.eq([classId])
                })
            })
        })

        context('when authorized within a school', () => {
            let userId: string
            let classId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                const organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                const schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_student_from_class_roster_20445,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    role.role_id
                )
                await addStudentToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the student from class', async () => {
                const gqlStudent = await removeStudentInClass(
                    testClient,
                    classId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlStudent).to.be.true
                const dbStudent = await User.findOneOrFail(userId)
                const dbClass = await Class.findOneOrFail(classId)
                const students = (await dbClass.students) || []
                const classesStudying = (await dbStudent.classesStudying) || []
                expect(students).to.be.empty
                expect(classesStudying).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove student in class', async () => {
                    const gqlStudent = await removeStudentInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlStudent).to.be.null
                    const dbStudent = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([userId])
                    expect(classesStudying.map(classInfo)).to.deep.eq([classId])
                })
            })
        })
    })

    describe('editSchools', () => {
        let school: School
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
            school = await createSchool(
                testClient,
                organization.organization_id,
                'my school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    editSchoolsInClass(
                        testClient,
                        cls.class_id,
                        [school.school_id],
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.be.empty
                expect(schools).to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have edit school permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_class_20334,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editSchoolsInClass(
                                testClient,
                                cls.class_id,
                                [school.school_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbSchool = await School.findOneOrFail(
                            school.school_id
                        )
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const schools = await dbClass.schools
                        const classes = await dbSchool.classes
                        expect(classes).to.be.empty
                        expect(schools).to.be.empty
                    })
                }
            )

            context('and the user does not have edit class permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_school_20330,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        editSchoolsInClass(
                            testClient,
                            cls.class_id,
                            [school.school_id],
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const schools = await dbClass.schools
                    const classes = await dbSchool.classes
                    expect(classes).to.be.empty
                    expect(schools).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                const schoolInfo = (s: School) => {
                    return s.school_id
                }
                const classInfo = (c: Class) => {
                    return c.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_school_20330,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('edits schools in class', async () => {
                    let gqlSchool = await editSchoolsInClass(
                        testClient,
                        cls.class_id,
                        [school.school_id],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool.map(schoolInfo)).to.deep.eq([
                        school.school_id,
                    ])
                    let dbSchool = await School.findOneOrFail(school.school_id)
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let schools = (await dbClass.schools) || []
                    let classes = (await dbSchool.classes) || []
                    expect(schools.map(schoolInfo)).to.deep.eq([
                        school.school_id,
                    ])
                    expect(classes.map(classInfo)).to.deep.eq([cls.class_id])

                    gqlSchool = await editSchoolsInClass(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.empty
                    dbSchool = await School.findOneOrFail(school.school_id)
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    schools = (await dbClass.schools) || []
                    classes = (await dbSchool.classes) || []
                    expect(schools).to.be.empty
                    expect(classes).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the schools in class', async () => {
                        const gqlSchool = await editSchoolsInClass(
                            testClient,
                            cls.class_id,
                            [school.school_id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSchool).to.be.null
                        const dbSchool = await School.findOneOrFail(
                            school.school_id
                        )
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const schools = await dbClass.schools
                        const classes = await dbSchool.classes
                        expect(classes).to.be.empty
                        expect(schools).to.be.empty
                    })
                })
            })
        })
    })

    describe('addSchool', () => {
        context('when not authenticated', () => {
            let school: School
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_school_20330,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addSchoolToClass(
                        testClient,
                        cls.class_id,
                        school.school_id,
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.be.empty
                expect(schools).to.be.empty
            })
        })

        context('when not authorized within organization', () => {
            let school: School
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addSchoolToClass(
                        testClient,
                        cls.class_id,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                ).to.be.rejected
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.be.empty
                expect(schools).to.be.empty
            })
        })

        context('when authorized within organization', () => {
            let school: School
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_school_20330,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should add school to class', async () => {
                const gqlSchool = await addSchoolToClass(
                    testClient,
                    cls.class_id,
                    school.school_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlSchool).to.exist
                expect(school).to.include(gqlSchool)
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.have.lengthOf(1)
                expect(schools).to.have.lengthOf(1)
                expect(classes![0].class_id).to.equal(dbClass.class_id)
                expect(schools![0].school_id).to.equal(dbSchool.school_id)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not add the school to class', async () => {
                    const gqlSchool = await addSchoolToClass(
                        testClient,
                        cls.class_id,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.null
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const schools = await dbClass.schools
                    const classes = await dbSchool.classes
                    expect(classes).to.be.empty
                    expect(schools).to.be.empty
                })
            })
        })
    })

    describe('removeSchool', () => {
        const schoolInfo = (school: School) => {
            return school.school_id
        }
        const classInfo = (cls: Class) => {
            return cls.class_id
        }

        context(
            'when not authorized within the organization or any school the class belongs to',
            () => {
                let userId: string
                let classId: string
                let schoolId: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    userId = (await createNonAdminUser(testClient))?.user_id
                    const organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwner.user_id
                        )
                    )?.organization_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'My School',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    )?.school_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        userId,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    await addUserToSchool(testClient, userId, schoolId, {
                        authorization: getAdminAuthToken(),
                    })
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    await addSchoolToClass(testClient, classId, schoolId, {
                        authorization: getAdminAuthToken(),
                    })
                    const emptyRole = await createRole(
                        testClient,
                        organizationId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        emptyRole.role_id
                    )
                    await addTeacherToClass(testClient, classId, userId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        removeSchoolFromClass(testClient, classId, schoolId, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                    const dbSchool = await School.findOneOrFail(schoolId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools.map(schoolInfo)).to.deep.eq([schoolId])
                    expect(schoolClasses.map(classInfo)).to.deep.eq([classId])
                })
            }
        )

        context('when authorized within organization', () => {
            let userId: string
            let classId: string
            let schoolId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                const organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    userId,
                    organizationId,
                    role.role_id
                )
                await addTeacherToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the school from class', async () => {
                const gqlTeacher = await removeSchoolFromClass(
                    testClient,
                    classId,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlTeacher).to.be.true
                const dbSchool = await School.findOneOrFail(schoolId)
                const dbClass = await Class.findOneOrFail(classId)
                const classSchools = (await dbClass.schools) || []
                const schoolClasses = (await dbSchool.classes) || []
                expect(classSchools).to.be.empty
                expect(schoolClasses).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove school from class', async () => {
                    const gqlTeacher = await removeSchoolFromClass(
                        testClient,
                        classId,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbSchool = await School.findOneOrFail(schoolId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools.map(schoolInfo)).to.deep.eq([schoolId])
                    expect(schoolClasses.map(classInfo)).to.deep.eq([classId])
                })
            })
        })

        context('when authorized within a school', () => {
            let userId: string
            let classId: string
            let schoolId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                const organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    role.role_id
                )
                await addTeacherToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the school from class', async () => {
                const gqlTeacher = await removeSchoolFromClass(
                    testClient,
                    classId,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlTeacher).to.be.true
                const dbSchool = await School.findOneOrFail(schoolId)
                const dbClass = await Class.findOneOrFail(classId)
                const classSchools = (await dbClass.schools) || []
                const schoolClasses = (await dbSchool.classes) || []
                expect(classSchools).to.be.empty
                expect(schoolClasses).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove school from class', async () => {
                    const gqlTeacher = await removeSchoolFromClass(
                        testClient,
                        classId,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbSchool = await School.findOneOrFail(schoolId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools.map(schoolInfo)).to.deep.eq([schoolId])
                    expect(schoolClasses.map(classInfo)).to.deep.eq([classId])
                })
            })
        })
    })

    describe('delete', () => {
        let school: School
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entry', async () => {
                await expect(
                    deleteClass(testClient, cls.class_id, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.status).to.eq(Status.ACTIVE)
                expect(dbClass.deleted_at).to.be.null
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete class permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entry', async () => {
                        await expect(
                            deleteClass(testClient, cls.class_id, {
                                authorization: getNonAdminAuthToken(),
                            })
                        ).to.be.rejected
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        expect(dbClass.status).to.eq(Status.ACTIVE)
                        expect(dbClass.deleted_at).to.be.null
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_class_20444,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('deletes the class', async () => {
                    const successful = await deleteClass(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(successful).to.be.true
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    expect(dbClass.status).to.eq(Status.INACTIVE)
                    expect(dbClass.deleted_at).not.to.be.null
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails to delete the class', async () => {
                        const successful = await deleteClass(
                            testClient,
                            cls.class_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(successful).to.be.null
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        expect(dbClass.status).to.eq(Status.INACTIVE)
                        expect(dbClass.deleted_at).not.to.be.null
                    })
                })
            })
        })
    })

    describe('programs', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let program: Program

        let programDetails: any

        const entityInfo = (entity: any) => {
            return entity.id
        }

        const programInfo = async (p: Program) => {
            return {
                name: p.name,
                age_ranges: ((await p.age_ranges) || []).map(entityInfo),
                grades: ((await p.grades) || []).map(entityInfo),
                subjects: ((await p.subjects) || []).map(entityInfo),
                system: p.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            program = createProgram(organization)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        it('lists all the programs in the class', async () => {
            programDetails = await programInfo(program)

            const gqlPrograms = await listPrograms(testClient, cls.class_id, {
                authorization: getNonAdminAuthToken(),
            })

            const dbClass = await Class.findOneOrFail(cls.class_id)
            const dbPrograms = (await dbClass.programs) || []

            const gqlProgramDetails = await Promise.all(
                gqlPrograms.map(programInfo)
            )
            const dbProgramDetails = await Promise.all(
                dbPrograms.map(programInfo)
            )

            expect(dbPrograms).not.to.be.empty
            expect(gqlProgramDetails).to.deep.eq([programDetails])
            expect(gqlProgramDetails).to.deep.eq(dbProgramDetails)
        })
    })

    describe('editPrograms', () => {
        let organization: Organization
        let cls: Class
        let program: Program
        let organizationId: string
        let otherUserId: string

        const programInfo = (p: any) => {
            return p.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)

            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            organizationId = organization.organization_id
            cls = await createClass(testClient, organization.organization_id)

            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )

            program = createProgram(organization)
            await program.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editPrograms(testClient, cls.class_id, [program.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbPrograms = (await cls.programs) || []
                expect(dbPrograms).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, organizationId)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editPrograms(testClient, cls.class_id, [program.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbPrograms = (await cls.programs) || []
                    expect(dbPrograms).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class programs', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbPrograms = (await dbClass.programs) || []
                    expect(dbPrograms).to.be.empty

                    let gqlPrograms = await editPrograms(
                        testClient,
                        cls.class_id,
                        [program.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbPrograms = (await dbClass.programs) || []
                    expect(dbPrograms).not.to.be.empty
                    expect(dbPrograms.map(programInfo)).to.deep.eq(
                        gqlPrograms.map(programInfo)
                    )

                    gqlPrograms = await editPrograms(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbPrograms = (await dbClass.programs) || []
                    expect(dbPrograms).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class programs', async () => {
                        const gqlPrograms = await editPrograms(
                            testClient,
                            cls.class_id,
                            [program.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlPrograms).to.be.null

                        const dbPrograms = (await cls.programs) || []
                        expect(dbPrograms).to.be.empty
                    })
                })
            })
        })
    })

    describe('age_ranges', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let ageRange: AgeRange
        let program: Program

        const ageRangeInfo = (ar: any) => {
            return {
                id: ar.id,
                name: ar.name,
                system: ar.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            ageRange = createAgeRange(organization)
            await ageRange.save()
            await editAgeRanges(testClient, cls.class_id, [ageRange.id], {
                authorization: getAdminAuthToken(),
            })
            program = createProgram(organization, [ageRange], [], [])
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        context('when not authenticated', () => {
            xit('fails to list age ranges in the class', async () => {
                await expect(
                    listAgeRanges(testClient, cls.class_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                // Test skipped because permission check no longer occurs in source
                // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                it.skip('fails to list age ranges in the class', async () => {
                    await expect(
                        listAgeRanges(testClient, cls.class_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_classes_20114,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the age ranges in the class', async () => {
                    const gqlAgeRanges = await listAgeRanges(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlAgeRanges).not.to.be.empty
                    expect(gqlAgeRanges.map(ageRangeInfo)).to.deep.eq([
                        ageRangeInfo(ageRange),
                    ])
                })
            })
        })
    })

    describe('grades', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let grade: Grade
        let program: Program

        const gradeInfo = (g: any) => {
            return {
                id: g.id,
                name: g.name,
                system: g.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            grade = createGrade(organization)
            await grade.save()
            await editGrades(testClient, cls.class_id, [grade.id], {
                authorization: getAdminAuthToken(),
            })
            program = createProgram(organization, [], [grade], [])
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        context('when not authenticated', () => {
            xit('fails to list grades in the class', async () => {
                await expect(
                    listGrades(testClient, cls.class_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                // Test skipped because permission check no longer occurs in source
                // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                it.skip('fails to list grades in the class', async () => {
                    await expect(
                        listGrades(testClient, cls.class_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_classes_20114,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the grades in the class', async () => {
                    const gqlGrades = await listGrades(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlGrades).not.to.be.empty
                    expect(gqlGrades.map(gradeInfo)).to.deep.eq([
                        gradeInfo(grade),
                    ])
                })
            })
        })
    })

    describe('subjects', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let subject: Subject
        let program: Program

        const subjectInfo = (s: any) => {
            return {
                id: s.id,
                name: s.name,
                system: s.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            subject = createSubject(organization)
            await subject.save()
            await editSubjects(testClient, cls.class_id, [subject.id], {
                authorization: getAdminAuthToken(),
            })
            program = createProgram(organization, [], [], [subject])
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        context('when not authenticated', () => {
            xit('fails to list subjects in the class', async () => {
                await expect(
                    listSubjects(testClient, cls.class_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                // Test skipped because permission check no longer occurs in source
                // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                it.skip('fails to list subjects in the class', async () => {
                    await expect(
                        listSubjects(testClient, cls.class_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_classes_20114,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the subjects in the class', async () => {
                    const gqlSubjects = await listSubjects(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlSubjects).not.to.be.empty
                    expect(gqlSubjects.map(subjectInfo)).to.deep.eq([
                        subjectInfo(subject),
                    ])
                })
            })
        })
    })

    describe('editAgeRanges', () => {
        let organization: Organization
        let cls: Class
        let ageRange: AgeRange
        let otherUserId: string

        const ageRangeInfo = (ar: any) => {
            return ar.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            ageRange = createAgeRange(organization)
            await ageRange.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editAgeRanges(testClient, cls.class_id, [ageRange.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbAgeRanges = (await cls.age_ranges) || []
                expect(dbAgeRanges).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organization.organization_id,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editAgeRanges(testClient, cls.class_id, [ageRange.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbAgeRanges = (await cls.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class age ranges', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbAgeRanges = (await dbClass.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty

                    let gqlAgeRanges = await editAgeRanges(
                        testClient,
                        cls.class_id,
                        [ageRange.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbAgeRanges = (await dbClass.age_ranges) || []
                    expect(dbAgeRanges).not.to.be.empty
                    expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                        gqlAgeRanges.map(ageRangeInfo)
                    )

                    gqlAgeRanges = await editAgeRanges(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbAgeRanges = (await dbClass.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class age ranges', async () => {
                        const gqlAgeRanges = await editAgeRanges(
                            testClient,
                            cls.class_id,
                            [ageRange.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlAgeRanges).to.be.null

                        const dbAgeRanges = (await cls.age_ranges) || []
                        expect(dbAgeRanges).to.be.empty
                    })
                })
            })
        })
    })

    describe('editGrades', () => {
        let organization: Organization
        let cls: Class
        let grade: Grade
        let otherUserId: string

        const gradeInfo = (g: any) => {
            return g.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            grade = createGrade(organization)
            await grade.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editGrades(testClient, cls.class_id, [grade.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbGrades = (await cls.grades) || []
                expect(dbGrades).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organization.organization_id,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editGrades(testClient, cls.class_id, [grade.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbGrades = (await cls.grades) || []
                    expect(dbGrades).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class grades', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbGrades = (await dbClass.grades) || []
                    expect(dbGrades).to.be.empty

                    let gqlGrades = await editGrades(
                        testClient,
                        cls.class_id,
                        [grade.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbGrades = (await dbClass.grades) || []
                    expect(dbGrades).not.to.be.empty
                    expect(dbGrades.map(gradeInfo)).to.deep.eq(
                        gqlGrades.map(gradeInfo)
                    )

                    gqlGrades = await editGrades(testClient, cls.class_id, [], {
                        authorization: getNonAdminAuthToken(),
                    })
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbGrades = (await dbClass.grades) || []
                    expect(dbGrades).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class grades', async () => {
                        const gqlGrades = await editGrades(
                            testClient,
                            cls.class_id,
                            [grade.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlGrades).to.be.null

                        const dbGrades = (await cls.grades) || []
                        expect(dbGrades).to.be.empty
                    })
                })
            })
        })
    })

    describe('editSubjects', () => {
        let organization: Organization
        let cls: Class
        let subject: Subject
        let otherUserId: string

        const subjectInfo = (s: any) => {
            return s.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            subject = createSubject(organization)
            await subject.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editSubjects(testClient, cls.class_id, [subject.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbSubjects = (await cls.subjects) || []
                expect(dbSubjects).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organization.organization_id,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editSubjects(testClient, cls.class_id, [subject.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbSubjects = (await cls.subjects) || []
                    expect(dbSubjects).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class subjects', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbSubjects = (await dbClass.subjects) || []
                    expect(dbSubjects).to.be.empty

                    let gqlSubjects = await editSubjects(
                        testClient,
                        cls.class_id,
                        [subject.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbSubjects = (await dbClass.subjects) || []
                    expect(dbSubjects).not.to.be.empty
                    expect(dbSubjects.map(subjectInfo)).to.deep.eq(
                        gqlSubjects.map(subjectInfo)
                    )

                    gqlSubjects = await editSubjects(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbSubjects = (await dbClass.subjects) || []
                    expect(dbSubjects).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class subjects', async () => {
                        const gqlSubjects = await editSubjects(
                            testClient,
                            cls.class_id,
                            [subject.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSubjects).to.be.null

                        const dbSubjects = (await cls.subjects) || []
                        expect(dbSubjects).to.be.empty
                    })
                })
            })
        })
    })

    describe('.deleteClasses', () => {
        let org1: Organization
        let org2: Organization
        let class1: Class
        let class2: Class
        let user1: User
        let role1: Role
        let role2: Role
        let input: DeleteClassInput[]

        function deleteClasses(i: DeleteClassInput[], u = user1) {
            return errorFormattingWrapper(
                deleteClassesResolver(
                    { input: i },
                    {
                        permissions: new UserPermissions({
                            id: u.user_id,
                            email: u.email,
                            phone: u.phone,
                        }),
                    }
                )
            )
        }

        async function checkClassesDeleted(i: DeleteClassInput[]) {
            const classIds = i.map((deleteClassInput) => deleteClassInput.id)
            const classes = await Class.find({
                where: {
                    class_id: In(classIds),
                    status: Status.INACTIVE,
                },
            })
            expect(classIds.length).to.equal(classes.length)
        }

        async function checkNoChangesMade() {
            expect(
                await Class.find({
                    where: {
                        class_id: In(input.map((v) => v.id)),
                        status: Status.INACTIVE,
                    },
                })
            ).to.be.empty
        }

        beforeEach(async () => {
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            class1 = await createClassFactory(undefined, org1).save()
            class2 = await createClassFactory(undefined, org2).save()
            role1 = await createRoleFactory(undefined, org1, {
                permissions: [PermissionName.delete_class_20444],
            }).save()
            role2 = await createRoleFactory(undefined, org2, {
                permissions: [PermissionName.delete_class_20444],
            }).save()
            user1 = await createUser().save()

            await createOrganizationMembership({
                user: user1,
                organization: org1,
                roles: [role1],
            }).save()

            input = [{ id: class1.class_id }, { id: class2.class_id }]
        })

        context('when user is admin', () => {
            let adminUser: User

            beforeEach(
                async () => (adminUser = await adminUserFactory().save())
            )

            context('when deleting 1 class', () => {
                it('deletes the class', async () => {
                    const singleClass = await createClassFactory().save()
                    const smallInput = [{ id: singleClass.class_id }]
                    await expect(deleteClasses(smallInput, adminUser)).to.be
                        .fulfilled
                    await checkClassesDeleted(smallInput)
                })
            })

            context('when deleting 1 class then 50 classes', () => {
                const dbCallCount = 3 // preloading 1, permission: 1, save: 1

                it('makes the same number of db calls', async () => {
                    const singleClass = await createClassFactory().save()
                    const smallInput = [{ id: singleClass.class_id }]
                    connection.logger.reset()
                    await deleteClasses(smallInput, adminUser)
                    expect(connection.logger.count).to.equal(dbCallCount)

                    const classes = await Class.save(createClasses(50))
                    const bigInput = classes.map((c) => {
                        return { id: c.class_id }
                    })
                    connection.logger.reset()
                    await deleteClasses(bigInput, adminUser)
                    expect(connection.logger.count).to.equal(dbCallCount)
                })
            })
        })

        context('when has permission for deleting classes', () => {
            context("and user belongs to classes' organizations", () => {
                beforeEach(async () => {
                    await createOrganizationMembership({
                        user: user1,
                        organization: org2,
                        roles: [role2],
                    }).save()
                })

                it('deletes classes', async () => {
                    await expect(deleteClasses(input)).to.be.fulfilled
                    await checkClassesDeleted(input)
                })

                it('makes the expected number of database calls', async () => {
                    connection.logger.reset()
                    await deleteClasses(input)
                    expect(connection.logger.count).to.equal(4) // preloading: 1, permissions: 2, save: 1
                })

                context('and a class is inactivated', () => {
                    beforeEach(async () => {
                        await class2.inactivate(getManager())
                    })

                    it('returns inactive_status error and does not inactivate the classes', async () => {
                        const res = await expect(deleteClasses(input)).to.be
                            .rejected
                        expectAPIError.inactive_status(
                            res,
                            {
                                entity: 'Class',
                                entityName: class2.class_id,
                                index: 1,
                            },
                            ['id'],
                            0,
                            1
                        )
                        expect(
                            await Class.find({
                                where: {
                                    class_id: In([class1.class_id]),
                                    status: Status.INACTIVE,
                                },
                            })
                        ).to.be.empty
                    })
                })

                context('and there is a duplicate class', () => {
                    beforeEach(async () => {
                        input.push({ id: class1.class_id })
                    })

                    it('returns duplicate_attribute_values error and does not inactivate the classes', async () => {
                        const res = await expect(deleteClasses(input)).to.be
                            .rejected
                        expectAPIError.duplicate_attribute_values(
                            res,
                            {
                                entity: 'DeleteClassInput',
                                attribute: '(id)',
                                index: 2,
                            },
                            ['id'],
                            0,
                            1
                        )
                        expect(
                            await Class.find({
                                where: {
                                    class_id: In([
                                        class1.class_id,
                                        class2.class_id,
                                    ]),
                                    status: Status.INACTIVE,
                                },
                            })
                        ).to.be.empty
                    })
                })
            })

            context(
                "and does not belong to at least one of classes' organizations",
                () => {
                    it('returns a permission error', async () => {
                        const expectedMessage =
                            `User(${user1.user_id}) does not have Permission` +
                            `(${PermissionName.delete_class_20444}) in Organizations(${org2.organization_id})`
                        await expect(deleteClasses(input)).to.be.rejectedWith(
                            expectedMessage
                        )
                        await checkNoChangesMade()
                    })
                }
            )
        })

        context('does not have permission for deleting classes', () => {
            it('returns a permission error', async () => {
                await createOrganizationMembership({
                    user: user1,
                    organization: org2,
                }).save()
                const expectedMessage =
                    `User(${user1.user_id}) does not have Permission` +
                    `(${PermissionName.delete_class_20444}) in Organizations(${org2.organization_id})`
                await expect(deleteClasses(input)).to.be.rejectedWith(
                    expectedMessage
                )
                await checkNoChangesMade()
            })
        })
    })
})
