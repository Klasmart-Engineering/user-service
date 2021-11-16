import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection, TestConnection } from '../utils/testConnection'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import {
    addStudentsToClass,
    createOrg,
    leaveTheOrganization,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { User } from '../../src/entities/user'
import { MY_USERS, USERS_CONNECTION } from '../utils/operations/modelOps'
import { GET_SCHOOL_MEMBERSHIPS_WITH_ORG } from '../utils/operations/userOps'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createSchool } from '../factories/school.factory'
import { createRole } from '../factories/role.factory'
import { createOrganization } from '../factories/organization.factory'
import { School } from '../../src/entities/school'
import { createUser } from '../factories/user.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { IPaginatedResponse } from '../../src/utils/pagination/paginate'
import { UserConnectionNode } from '../../src/types/graphQL/user'
import { makeRequest } from './utils'
import { createClass } from '../factories/class.factory'
import { Class } from '../../src/entities/class'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const usersCount = 6
const classesCount = 2

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
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        classIds = []

        await loadFixtures('users', connection)
        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        orgId = createOrg1Data.organization_id

        const organization = await Organization.findOneOrFail(orgId)

        const users = await User.save(
            Array(usersCount).fill(undefined).map(createUser)
        )

        await OrganizationMembership.save(
            users.map((user) =>
                createOrganizationMembership({ user, organization })
            )
        )

        userIds = users.map(({ user_id }) => user_id)
        userEmails = users.map(({ email }) => email ?? '')

        for (let i = 0; i < classesCount; i++) {
            const uIds = [
                userIds[i * 3],
                userIds[i * 3 + 1],
                userIds[i * 3 + 2],
            ]

            const class_ = await createClass([], organization).save()
            classIds.push(class_.class_id)
            await addStudentsToClass(class_.class_id, uIds, getAdminAuthToken())
        }
    })

    it('queries current user information successfully', async () => {
        const response = await request
            .post('/user')
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
                .post('/user')
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
        context('using explict count', async () => {
            async function makeQuery(pageSize: any) {
                return await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: USERS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            directionArgs: {
                                count: pageSize,
                            },
                        },
                    })
            }

            it('passes validation', async () => {
                const pageSize = 5

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(200)
                const usersConnection = response.body.data.usersConnection
                expect(usersConnection.edges.length).to.equal(pageSize)
            })

            it('fails validation', async () => {
                const pageSize = 'not_a_number'

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(400)
                expect(response.body.errors.length).to.equal(1)
                const message = response.body.errors[0].message
                expect(message)
                    .to.be.a('string')
                    .and.satisfy((msg: string) =>
                        msg.startsWith(
                            'Variable "$directionArgs" got invalid value "not_a_number" at "directionArgs.count"; Expected type "PageSize".'
                        )
                    )
            })
        })
        it('queries paginated users without filter', async () => {
            const response = await request
                .post('/user')
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
                .post('/user')
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
            expect(usersConnection.totalCount).to.equal(3)
        })

        it('responds with an error if the filter is wrong', async () => {
            const classId = 'inval-id'
            const response = await request
                .post('/user')
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

        it('queries without errors when role is School Admin and does not belong to any schools', async () => {
            const user = await createUser().save()
            const org = await createOrganization().save()

            const role = await createRole(undefined, org, {
                permissions: [PermissionName.view_my_school_users_40111],
            }).save()
            await createOrganizationMembership({
                user: user,
                organization: org,
                roles: [role],
            }).save()

            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: token,
                })
                .send({
                    query: USERS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })
            expect(response.status).to.eq(200)
        })

        it('has organizationMembershipsConnection as a child', async () => {
            const query = `
                query usersConnection($direction: ConnectionDirection!) {
                    usersConnection(direction:$direction){
                        edges {
                            node {
                                organizationMembershipsConnection{
                                    edges{
                                        node{
                                            organizationId
                                            organization {
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            const user = await createUser().save()
            const org = await createOrganization().save()

            const role = await createRole(undefined, org).save()
            await createOrganizationMembership({
                user: user,
                organization: org,
                roles: [role],
            }).save()

            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                },
                token
            )
            expect(response.status).to.eq(200)
            const usersConnection: IPaginatedResponse<UserConnectionNode> =
                response.body.data.usersConnection
            const orgNode = usersConnection.edges[0].node
                .organizationMembershipsConnection!.edges[0].node
            expect(orgNode.organizationId).to.eq(org.organization_id)
            expect(orgNode.organization!.id).to.eq(org.organization_id)
        })

        it('has schoolMembershipsConnection as a child', async () => {
            const query = `
                query usersConnection($direction: ConnectionDirection!) {
                    usersConnection(direction:$direction){
                        edges {
                            node {
                                schoolMembershipsConnection{
                                    edges{
                                        node{
                                            schoolId
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            const user = await createUser().save()
            const org = await createOrganization().save()
            const school = await createSchool(org).save()

            const role = await createRole(undefined, org, {
                permissions: [PermissionName.view_school_20110],
            }).save()
            await createOrganizationMembership({
                user: user,
                organization: org,
                roles: [role],
            }).save()
            await createSchoolMembership({
                user: user,
                school: school,
            }).save()

            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                },
                token
            )
            expect(response.status).to.eq(200)
            const usersConnection: IPaginatedResponse<UserConnectionNode> =
                response.body.data.usersConnection
            expect(
                usersConnection.edges[0].node.schoolMembershipsConnection!
                    .edges[0].node.schoolId
            ).to.eq(school.school_id)
        })

        context('classes child connections', () => {
            let user: User
            let classStudying: Class
            let classTeaching: Class
            let userToken: string

            beforeEach(async () => {
                user = await createUser().save()
                const org = await createOrganization().save()

                const role = await createRole(undefined, org, {
                    permissions: [
                        PermissionName.view_users_40110,
                        PermissionName.view_classes_20114,
                    ],
                }).save()
                await createOrganizationMembership({
                    user: user,
                    organization: org,
                    roles: [role],
                }).save()

                classStudying = await createClass([], org, {
                    students: [user],
                }).save()
                classTeaching = await createClass([], org, {
                    teachers: [user],
                }).save()

                userToken = generateToken({
                    id: user.user_id,
                    email: user.email,
                    iss: 'calmid-debug',
                })
            })

            it('has classesStudyingConnection as a child', async () => {
                const query = `
                    query usersConnection($direction: ConnectionDirection!) {
                        usersConnection(direction:$direction){
                            edges {
                                node {
                                    classesStudyingConnection {
                                        edges{
                                            node{
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }`

                const response = await makeRequest(
                    request,
                    query,
                    {
                        direction: 'FORWARD',
                    },
                    userToken
                )
                expect(
                    response.body.data.usersConnection.edges[0].node
                        .classesStudyingConnection.edges[0].node.id
                ).to.eq(classStudying.class_id)
            })
            it('has classesTeachingConnection as a child', async () => {
                const query = `
                    query usersConnection($direction: ConnectionDirection!) {
                        usersConnection(direction:$direction){
                            edges {
                                node {
                                    classesTeachingConnection {
                                        edges{
                                            node{
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }`
                const response = await makeRequest(
                    request,
                    query,
                    {
                        direction: 'FORWARD',
                    },
                    userToken
                )
                expect(
                    response.body.data.usersConnection.edges[0].node
                        .classesTeachingConnection.edges[0].node.id
                ).to.eq(classTeaching.class_id)
            })
        })
    })

    context('my_users', async () => {
        it('Finds no users if I am not logged in', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: '',
                })
                .send({
                    query: MY_USERS,
                })

            expect(response.status).to.eq(400)
            expect(response.body.errors.length).to.equal(1)
            expect(response.body.errors[0]['message']).to.equal(
                'Context creation failed: No authentication token'
            )
        })

        it('Finds one user with active membership ', async () => {
            const token = generateToken({
                id: userIds[0],
                email: userEmails[0],
                iss: 'calmid-debug',
            })
            const response = await request
                .post('/user')
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
                .post('/user')
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
