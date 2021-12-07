import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { School } from '../../../src/entities/school'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { createOrganization } from '../../factories/organization.factory'
import { createUser } from '../../factories/user.factory'
import { createClass } from '../../factories/class.factory'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { userToPayload } from '../../utils/operations/userOps'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { expect } from 'chai'
import { Role } from '../../../src/entities/role'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { getRepository } from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { eligibleMembersConnectionResolver } from '../../../src/pagination/eligibleMembersConnection'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { Context } from '../../../src/main'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'

describe('eligibleMembersConnection', () => {
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

    let teacherId: string
    let teacher: User
    let studentId: string
    let student: User
    let teacherRoleId: string
    let studentRoleId: string
    let teacherRole: Role
    let studentRole: Role
    let classId: string
    let organization: Organization
    let orgOwnerPermissions: UserPermissions
    let ctx: Context
    let studentMembership: OrganizationMembership
    let teacherMembership: OrganizationMembership

    const info = ({
        fieldNodes: [
            {
                selectionSet: {
                    selections: [
                        {
                            kind: 'Field',

                            name: {
                                value: 'totalCount',
                            },
                        },
                    ],
                },
            },
        ],
    } as unknown) as GraphQLResolveInfo
    const mutationInfo = ({
        operation: {
            operation: 'mutation',
        },
    } as unknown) as GraphQLResolveInfo
    beforeEach(async () => {
        const orgOwner = await createAdminUser(testClient)
        orgOwnerPermissions = new UserPermissions(userToPayload(orgOwner))
        await createNonAdminUser(testClient)
        ctx = ({
            permissions: orgOwnerPermissions,
        } as unknown) as Context
        teacher = await createUser({ email: 'teacher@gmail.com' }).save()
        teacherId = teacher.user_id
        student = await createUser({ email: 'student@gmail.com' }).save()
        studentId = student.user_id
        organization = await createOrganization(orgOwner).save()

        teacherMembership = await createOrganizationMembership({
            user: teacher,
            organization,
        }).save()
        studentMembership = await createOrganizationMembership({
            user: student,
            organization,
        }).save()

        classId = (await createClass(undefined, organization).save()).class_id

        teacherRole = await createRole('Teacher Role', organization).save()
        teacherRoleId = teacherRole.role_id
        studentRole = await createRole('Student Role', organization).save()
        studentRoleId = studentRole.role_id
    })
    describe('eligibleTeachersConnection', () => {
        context(
            'when one user is authorized to attend a live class as a teacher, and another as a student',
            () => {
                beforeEach(async () => {
                    const promiseGrantPerms = []
                    promiseGrantPerms.push(
                        teacherRole.grant(
                            {
                                permission_name:
                                    PermissionName.attend_live_class_as_a_teacher_186,
                            },
                            ctx,
                            mutationInfo
                        )
                    )

                    promiseGrantPerms.push(
                        studentRole.grant(
                            {
                                permission_name:
                                    PermissionName.attend_live_class_as_a_student_187,
                            },
                            ctx,
                            mutationInfo
                        )
                    )
                    await Promise.all(promiseGrantPerms)
                })

                context('and via organization permission', () => {
                    beforeEach(async () => {
                        const promiseAddRoleToOrg = []
                        promiseAddRoleToOrg.push(
                            teacherMembership.addRole(
                                { role_id: teacherRoleId },
                                ctx,
                                mutationInfo
                            )
                        )
                        promiseAddRoleToOrg.push(
                            studentMembership.addRole(
                                { role_id: studentRoleId },
                                ctx,
                                mutationInfo
                            )
                        )
                        await Promise.all(promiseAddRoleToOrg)
                    })

                    it('returns an connection containing the teacher', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_teacher_186',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )
                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(1)
                        expect(userIds[0]).to.equal(teacherId)
                    })
                })

                context('and via school permission', () => {
                    beforeEach(async () => {
                        const school = await createSchool(
                            organization,
                            'My School'
                        ).save()
                        const promiseMembers = []
                        promiseMembers.push(
                            createSchoolMembership({
                                user: teacher,
                                school: school,
                                roles: [teacherRole],
                            }).save()
                        )
                        promiseMembers.push(
                            createSchoolMembership({
                                user: student,
                                school: school,
                                roles: [studentRole],
                            }).save()
                        )
                        await Promise.all(promiseMembers)
                    })

                    it('returns an array containing the teacher', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_teacher_186',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )

                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(1)
                        expect(userIds[0]).to.equal(teacherId)
                    })
                })
            }
        )

        context(
            "when a user's permission to attend a live class as a teacher has been denied",
            () => {
                beforeEach(async () => {
                    await teacherRole.deny(
                        {
                            permission_name:
                                PermissionName.attend_live_class_as_a_teacher_186,
                        },
                        ctx,
                        mutationInfo
                    )
                })

                context('and via organization permission', () => {
                    beforeEach(async () => {
                        await teacherMembership.addRole(
                            { role_id: teacherRoleId },
                            ctx,
                            mutationInfo
                        )
                    })

                    it('returns an empty array', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_teacher_186',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )

                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(0)
                    })
                })

                context('and via school permission', () => {
                    beforeEach(async () => {
                        const school = await createSchool(
                            organization,
                            'My School'
                        ).save()

                        await createSchoolMembership({
                            user: teacher,
                            school: school,
                            roles: [teacherRole],
                        }).save()
                    })

                    it('returns an empty array', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_teacher_186',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )

                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(0)
                    })
                })
            }
        )
    })
    describe('eligibleStudentsConnection', () => {
        context(
            'when one user is authorized to attend a live class as a teacher, and another as a student',
            () => {
                beforeEach(async () => {
                    const promiseGrantPerms = []
                    promiseGrantPerms.push(
                        teacherRole.grant(
                            {
                                permission_name:
                                    PermissionName.attend_live_class_as_a_teacher_186,
                            },
                            ctx,
                            mutationInfo
                        )
                    )
                    promiseGrantPerms.push(
                        studentRole.grant(
                            {
                                permission_name:
                                    PermissionName.attend_live_class_as_a_student_187,
                            },
                            ctx,
                            mutationInfo
                        )
                    )

                    await Promise.all(promiseGrantPerms)
                })

                context('and via organization permission', () => {
                    beforeEach(async () => {
                        const promiseAddRoleToOrg = []
                        promiseAddRoleToOrg.push(
                            teacherMembership.addRole(
                                {
                                    role_id: teacherRoleId,
                                },
                                ctx,
                                mutationInfo
                            )
                        )
                        promiseAddRoleToOrg.push(
                            studentMembership.addRole(
                                {
                                    role_id: studentRoleId,
                                },
                                ctx,
                                mutationInfo
                            )
                        )
                        await Promise.all(promiseAddRoleToOrg)
                    })

                    it('returns an array containing only the student', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_student_187',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )
                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(1)
                        expect(userIds[0]).to.equal(studentId)
                    })
                })

                context('and via school permission', () => {
                    beforeEach(async () => {
                        const school = await createSchool(
                            organization,
                            'My School'
                        ).save()

                        await createSchoolMembership({
                            user: teacher,
                            school: school,
                            roles: [teacherRole],
                        }).save()

                        await createSchoolMembership({
                            user: student,
                            school: school,
                            roles: [studentRole],
                        }).save()
                    })

                    it('returns an array containing the student', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_student_187',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )

                        const userIds = conn.edges.map((x) => x.node.id)

                        expect(userIds).to.have.length(1)
                        expect(userIds[0]).to.equal(studentId)
                    })
                })
            }
        )

        context(
            "when a user's permission to attend a live class as a student has been denied",
            () => {
                beforeEach(async () => {
                    await studentRole.deny(
                        {
                            permission_name:
                                PermissionName.attend_live_class_as_a_student_187,
                        },
                        ctx,
                        mutationInfo
                    )
                })

                context('and via organization permission', () => {
                    beforeEach(async () => {
                        await studentMembership.addRole(
                            { role_id: studentRoleId },
                            ctx,
                            mutationInfo
                        )
                    })

                    it('returns an empty array', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_student_187',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )
                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(0)
                    })
                })

                context('and via school permission', () => {
                    beforeEach(async () => {
                        const school = await createSchool(
                            organization,
                            'My School'
                        ).save()
                        await createSchoolMembership({
                            user: student,
                            school: school,
                            roles: [studentRole],
                        }).save()
                    })

                    it('returns an empty array', async () => {
                        const scope = getRepository(User).createQueryBuilder()
                        const conn = await eligibleMembersConnectionResolver(
                            info,
                            'attend_live_class_as_a_student_187',
                            {
                                classId,
                                direction: 'FORWARD',
                                directionArgs: {
                                    count: 50,
                                },
                                scope,
                            }
                        )

                        const userIds = conn.edges.map((x) => x.node.id)
                        expect(userIds).to.have.length(0)
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
            const numMembers = 2
            beforeEach(async () => {
                org = organization
                schools = []
                students = []
                teachers = []

                const orgOwner = await createAdminUser(testClient)
                org = await createOrganization(orgOwner).save()

                teacherRole = await createRole('Teacher Role', org).save()
                studentRole = await createRole('Student Role', org).save()

                class1 = await createClass(undefined, org).save()

                const promiseGrantPerms = []
                promiseGrantPerms.push(
                    teacherRole.grant(
                        {
                            permission_name:
                                PermissionName.attend_live_class_as_a_teacher_186,
                        },
                        ctx,
                        mutationInfo
                    )
                )
                promiseGrantPerms.push(
                    studentRole.grant(
                        {
                            permission_name:
                                PermissionName.attend_live_class_as_a_student_187,
                        },
                        ctx,
                        mutationInfo
                    )
                )

                await Promise.all(promiseGrantPerms)

                const promiseSchools = []
                for (let i = 0; i < numMembers; i++) {
                    promiseSchools.push(createSchool(org, `School ${i}`).save())
                }
                schools = await Promise.all(promiseSchools)
                const promiseStudents = []
                const promiseTeachers = []
                for (let i = 0; i < numMembers; i++) {
                    promiseStudents.push(
                        createUser({
                            email: `student${i}@school.com`,
                        }).save()
                    )
                    promiseTeachers.push(
                        createUser({
                            email: `teacher${i}@school.com`,
                        }).save()
                    )
                }
                students = await Promise.all(promiseStudents)
                teachers = await Promise.all(promiseTeachers)
                const promiseAddUserToOrg = []
                for (let i = 0; i < numMembers; i++) {
                    promiseAddUserToOrg.push(
                        createOrganizationMembership({
                            user: students[i],
                            organization: org,
                            roles: [studentRole],
                        }).save()
                    )
                    promiseAddUserToOrg.push(
                        createOrganizationMembership({
                            user: teachers[i],
                            organization: org,
                            roles: [teacherRole],
                        }).save()
                    )
                }
                await Promise.all(promiseAddUserToOrg)

                const promiseAddUserToSchool = []
                for (let i = 0; i < numMembers; i++) {
                    promiseAddUserToSchool.push(
                        createSchoolMembership({
                            user: students[i],
                            school: schools[i],
                            roles: [studentRole],
                        }).save()
                    )
                    promiseAddUserToSchool.push(
                        createSchoolMembership({
                            user: teachers[i],
                            school: schools[i],
                            roles: [teacherRole],
                        }).save()
                    )
                }

                await Promise.all(promiseAddUserToSchool)
            })
            it('returns all org students if the class has not been assigned to a school', async () => {
                const scope = getRepository(User).createQueryBuilder()
                const conn = await eligibleMembersConnectionResolver(
                    info,
                    'attend_live_class_as_a_student_187',
                    {
                        classId: class1.class_id,
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                        scope,
                    }
                )

                expect(conn.edges.length).to.eq(numMembers)
            })

            it('returns all org teachers if the class has not been assigned to a school', async () => {
                const scope = getRepository(User).createQueryBuilder()
                const conn = await eligibleMembersConnectionResolver(
                    info,
                    'attend_live_class_as_a_teacher_186',
                    {
                        classId: class1.class_id,
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                        scope,
                    }
                )

                expect(conn.edges.length).to.eq(numMembers) // 2 teachers
            })

            it('only returns students from the schools that the class has been added to', async () => {
                await class1.addSchool(
                    { school_id: schools[0].school_id },
                    ctx,
                    mutationInfo
                )

                let scope = getRepository(User).createQueryBuilder()
                let conn = await eligibleMembersConnectionResolver(
                    info,
                    'attend_live_class_as_a_student_187',
                    {
                        classId: class1.class_id,
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                        scope,
                    }
                )

                expect(conn.edges.length).to.eq(1)
                await class1.addSchool(
                    { school_id: schools[1].school_id },
                    ctx,
                    mutationInfo
                )

                scope = getRepository(User).createQueryBuilder()
                conn = await eligibleMembersConnectionResolver(
                    info,
                    'attend_live_class_as_a_student_187',
                    {
                        classId: class1.class_id,
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                        scope,
                    }
                )
                expect(conn.edges.length).to.eq(numMembers)
            })

            it('only returns teachers from the schools that the class has been added to', async () => {
                await class1.addSchool(
                    { school_id: schools[0].school_id },
                    ctx,
                    mutationInfo
                )

                let scope = getRepository(User).createQueryBuilder()
                let conn = await eligibleMembersConnectionResolver(
                    info,
                    'attend_live_class_as_a_teacher_186',
                    {
                        classId: class1.class_id,
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                        scope,
                    }
                )
                expect(conn.edges.length).to.eq(1)
                await class1.addSchool(
                    { school_id: schools[1].school_id },
                    ctx,
                    mutationInfo
                )

                scope = getRepository(User).createQueryBuilder()
                conn = await eligibleMembersConnectionResolver(
                    info,
                    'attend_live_class_as_a_teacher_186',
                    {
                        classId: class1.class_id,
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                        scope,
                    }
                )
                expect(conn.edges.length).to.eq(numMembers)
            })
        })
    })
})
