import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection } from '../utils/testConnection'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import {
    addStudentsToClass,
    inviteUserToOrganization,
    createClass,
    createOrg,
    leaveTheOrganization,
    addTeachersToClass,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { User } from '../../src/entities/user'
import { MY_USERS, USERS_CONNECTION } from '../utils/operations/modelOps'
import {
    userToPayload,
    GET_SCHOOL_MEMBERSHIPS_WITH_ORG,
} from '../utils/operations/userOps'
import { leaveOrganization } from '../utils/operations/organizationMembershipOps'
import { createSchool } from '../factories/school.factory'
import { createOrganization } from '../factories/organization.factory'
import { School } from '../../src/entities/school'
import { createUser } from '../factories/user.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { Organization } from '../../src/entities/organization'
import { PermissionName } from '../../src/permissions/permissionNames'
import RolesInitializer from '../../src/initializers/roles'
import { getSystemRoleIds } from '../utils/operations/organizationOps'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const usersCount = 6
const classesCount = 2
const studentPermission = PermissionName.attend_live_class_as_a_student_187
const teacherPermission = PermissionName.attend_live_class_as_a_teacher_186

let orgId: string
let userIds: string[]
let classIds: string[]
let userEmails: string[]

const ME = `
    query {
        me {
            username
            email
        }
    }
`

describe('acceptance.user', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        userIds = []
        userEmails = []
        classIds = []

        await RolesInitializer.run()
        const systemRoles = await getSystemRoleIds()
        const teacherRoleId = systemRoles['Teacher']
        const studentRoleId = systemRoles['Student']

        await loadFixtures('users', connection)
        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        orgId = createOrg1Data.organization_id

        // Creating Users
        for (let i = 0; i < usersCount; i++) {
            let roleIds = []

            if (i % 3 < 2) {
                roleIds.push(teacherRoleId)
            }

            if (i % 3 > 0) {
                roleIds.push(studentRoleId)
            }

            const response = await inviteUserToOrganization(
                `given${i + 1}`,
                `family${i + 1}`,
                `user${i + 1}@gmail.com`,
                orgId,
                getAdminAuthToken(),
                roleIds
            )

            const id = response.body.data.organization.inviteUser.user.user_id
            userIds.push(id)
            userEmails.push(`user${i + 1}@gmail.com`)
        }

        // Creating classes and assigning students an teachers
        for (let i = 0; i < classesCount; i++) {
            const uIds = [
                userIds[i * 3],
                userIds[i * 3 + 1],
                userIds[i * 3 + 2],
            ]

            const sharedUserId = i ? userIds[2] : userIds[5]

            const teacherIds = [uIds[0], uIds[1]]
            const studentIds = [uIds[1], uIds[2], sharedUserId]

            const classResponse = await createClass(
                orgId,
                `class ${i + 1}`,
                getAdminAuthToken()
            )

            const classId =
                classResponse.body.data.organization.createClass.class_id

            classIds.push(classId)
            await addStudentsToClass(classId, studentIds, getAdminAuthToken())
            await addTeachersToClass(classId, teacherIds, getAdminAuthToken())
        }
    })

    it('queries current user information successfully', async () => {
        const response = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: ME,
            })

        expect(response.status).to.eq(200)
        expect(response.body.data.me.email).to.equal('joe@gmail.com')
    })

    context('school membership dataloaders', () => {
        let myUser: User
        let myOrg: Organization
        beforeEach(async () => {
            myUser = await createUser().save()
            myOrg = await createOrganization().save()
            const mySchools = await School.save(
                Array.from(Array(5), (v: unknown, i: number) =>
                    createSchool(myOrg)
                )
            )

            for (let i = 0; i < 5; i++) {
                await createSchoolMembership({
                    user: myUser,
                    school: mySchools[i],
                }).save()
            }

            // create another user in different school to ensure they're not returned
            const otherUser = await createUser().save()
            const otherOrg = await createOrganization().save()
            const otherSchools = await School.save(
                Array.from(Array(5), (v: unknown, i: number) =>
                    createSchool(myOrg)
                )
            )
            for (let i = 0; i < 5; i++) {
                await createSchoolMembership({
                    user: otherUser,
                    school: otherSchools[i],
                }).save()
            }
        })
        it('loads nested school membership relations', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: GET_SCHOOL_MEMBERSHIPS_WITH_ORG,
                    variables: {
                        user_id: myUser.user_id,
                    },
                })
            const result = response.body.data
            expect(result.user.school_memberships.length).to.eq(5)
            for (const membership of result.user.school_memberships) {
                expect(membership.school.organization.organization_id).to.eq(
                    myOrg.organization_id
                )
            }
        })
    })

    context('usersConnection', () => {
        it('queries paginated users without filter', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: USERS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const usersConnection = response.body.data.usersConnection

            expect(response.status).to.eq(200)
            expect(usersConnection.totalCount).to.equal(usersCount + 1)
        })

        it('queries paginated users filtered by classId', async () => {
            const classId = classIds[0]
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: USERS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            classId: {
                                operator: 'eq',
                                value: classId,
                            },
                        },
                    },
                })

            const usersConnection = response.body.data.usersConnection

            expect(response.status).to.eq(200)
            expect(usersConnection.totalCount).to.equal(4)
        })

        it('responds with an error if the filter is wrong', async () => {
            const classId = 'inval-id'
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: USERS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            classId: {
                                operator: 'eq',
                                value: classId,
                            },
                        },
                    },
                })

            expect(response.status).to.eq(400)
            expect(response.body).to.have.property('errors')
        })

        context('School Roster', () => {
            it('queries all the school roster users in a class', async () => {
                const classId = classIds[0]
                const response = await request
                    .post('/graphql')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: USERS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                // just active users
                                organizationUserStatus: {
                                    operator: 'eq',
                                    value: 'active',
                                },
                                // just users involved in the organization
                                organizationId: {
                                    operator: 'eq',
                                    value: orgId,
                                },
                                // get teachers and students
                                permissionIds: {
                                    operator: 'in',
                                    value: [
                                        studentPermission,
                                        teacherPermission,
                                    ],
                                },
                                // just users that are not involved in the class
                                classId: {
                                    operator: 'ex',
                                    value: classId,
                                },
                            },
                        },
                    })

                const usersConnection = response.body.data.usersConnection

                expect(response.status).to.eq(200)
                expect(usersConnection.totalCount).to.equal(4)
            })

            it('queries just the school roster students in a class', async () => {
                const classId = classIds[0]
                const response = await request
                    .post('/graphql')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: USERS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                // just active users
                                organizationUserStatus: {
                                    operator: 'eq',
                                    value: 'active',
                                },
                                // just users involved in the organization
                                organizationId: {
                                    operator: 'eq',
                                    value: orgId,
                                },
                                // get just students
                                permissionIds: {
                                    operator: 'in',
                                    value: [studentPermission],
                                },
                                // just users that are not involved in the class
                                classId: {
                                    operator: 'ex',
                                    value: classId,
                                },
                            },
                        },
                    })

                const usersConnection = response.body.data.usersConnection

                expect(response.status).to.eq(200)
                expect(usersConnection.totalCount).to.equal(1)
            })

            it('queries just the school roster teachers in a class', async () => {
                const classId = classIds[0]
                const response = await request
                    .post('/graphql')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: USERS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                // just active users
                                organizationUserStatus: {
                                    operator: 'eq',
                                    value: 'active',
                                },
                                // just users involved in the organization
                                organizationId: {
                                    operator: 'eq',
                                    value: orgId,
                                },
                                // get just teachers
                                permissionIds: {
                                    operator: 'in',
                                    value: [teacherPermission],
                                },
                                // just users that are not involved in the class
                                classId: {
                                    operator: 'ex',
                                    value: classId,
                                },
                            },
                        },
                    })

                const usersConnection = response.body.data.usersConnection

                expect(response.status).to.eq(200)
                expect(usersConnection.totalCount).to.equal(3)
            })
        })
    })

    context('my_users', async () => {
        it('Finds no users if I am not logged in', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: '',
                })
                .send({
                    query: MY_USERS,
                })

            expect(response.status).to.eq(200)
            expect(response.body.data.my_users.length).to.equal(0)
        })

        it('Finds one user with active membership ', async () => {
            const token = generateToken({
                id: userIds[0],
                email: userEmails[0],
                iss: 'calmid-debug',
            })
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: token,
                })
                .send({
                    query: MY_USERS,
                })

            expect(response.status).to.eq(200)
            expect(response.body.data.my_users.length).to.equal(1)
        })
        it('Finds no users if my membership is inactive', async () => {
            await leaveTheOrganization(userIds[0], orgId, getAdminAuthToken())
            const token = generateToken({
                id: userIds[0],
                email: userEmails[0],
                iss: 'calmid-debug',
            })
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: token,
                })
                .send({
                    query: MY_USERS,
                })

            expect(response.status).to.eq(200)
            expect(response.body.data.my_users.length).to.equal(0)
        })
    })
})
