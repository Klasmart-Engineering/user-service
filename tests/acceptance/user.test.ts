import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { expect, use } from 'chai'
import { before } from 'mocha'
import { TestConnection } from '../utils/testConnection'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import {
    addStudentsToClass,
    createOrg,
    leaveTheOrganization,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { User } from '../../src/entities/user'
import {
    ELIGIBLE_STUDENTS_CONNECTION,
    MY_USERS,
    USERS_CONNECTION,
} from '../utils/operations/modelOps'
import {
    ADD_ORG_ROLES_TO_USERS,
    ADD_SCHOOL_ROLES_TO_USERS,
    CREATE_USERS,
    GET_SCHOOL_MEMBERSHIPS_WITH_ORG,
    randomChangeToUpdateUserInput,
    REMOVE_ORG_ROLES_FROM_USERS,
    REMOVE_SCHOOL_ROLES_FROM_USERS,
    UPDATE_USERS,
    userToCreateUserInput,
    userToPayload,
    userToUpdateUserInput,
} from '../utils/operations/userOps'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createSchool, createSchools } from '../factories/school.factory'
import { createRole, createRoles } from '../factories/role.factory'
import { createOrganization } from '../factories/organization.factory'
import { School } from '../../src/entities/school'
import { createUser, createUsers } from '../factories/user.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { IPaginatedResponse } from '../../src/utils/pagination/paginate'
import { failsValidation, makeRequest } from './utils'
import { createClass } from '../factories/class.factory'
import { Class } from '../../src/entities/class'
import {
    AddOrganizationRolesToUserInput,
    AddSchoolRolesToUserInput,
    RemoveOrganizationRolesFromUserInput,
    RemoveSchoolRolesFromUserInput,
    UpdateUserInput,
    UserConnectionNode,
} from '../../src/types/graphQL/user'
import { Role } from '../../src/entities/role'
import { CreateUserInput } from '../../src/types/graphQL/user'
import {
    CoreUserConnectionNode,
    extractCoreUserConnectionNode,
    mapUserToUserConnectionNode,
} from '../../src/pagination/usersConnection'
import { config } from '../../src/config/config'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { v4 } from 'uuid'
import { getConnection } from 'typeorm'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)
const adminUserId = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const usersCount = 50
const classesCount = 2
const rolesCount = 20
let users: User[]
let students: User[]
let orgId: string
let userIds: string[]
let classIds: string[]
let userEmails: string[]
let organization: Organization
let simpleStudentRole: Role

const ME = `
    query {
        me {
            username
            email
        }
    }
`

describe('acceptance.user', () => {
    let memberships: OrganizationMembership[]
    let schoolMemberships: SchoolMembership[]
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        classIds = []

        await loadFixtures('users', connection)
        const createOrg1Response = await createOrg(
            adminUserId,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        orgId = createOrg1Data.organization_id

        organization = await Organization.findOneOrFail(orgId)

        users = await User.save(
            Array(usersCount).fill(undefined).map(createUser)
        )

        simpleStudentRole = await createRole(undefined, organization, {
            permissions: [PermissionName.attend_live_class_as_a_student_187],
        }).save()

        memberships = await OrganizationMembership.save(
            users.map((user) =>
                createOrganizationMembership({
                    user,
                    organization,
                    roles: [simpleStudentRole],
                })
            )
        )

        userIds = users.map(({ user_id }) => user_id)
        userEmails = users.map(({ email }) => email ?? '')

        for (let i = 0; i < classesCount; i++) {
            students = [users[i * 3], users[i * 3 + 1], users[i * 3 + 2]]

            const class_ = await createClass([], organization).save()
            classIds.push(class_.class_id)
            await addStudentsToClass(
                class_.class_id,
                students.map((u) => u.user_id),
                getAdminAuthToken()
            )
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
                Array.from(Array(5), () => createSchool(myOrg))
            )

            for (let i = 0; i < 5; i++) {
                await createSchoolMembership({
                    user: myUser,
                    school: mySchools[i],
                }).save()
            }

            // create another user in different school to ensure they're not returned
            const otherUser = await createUser().save()
            await createOrganization().save()
            const otherSchools = await School.save(
                Array.from(Array(5), () => createSchool(myOrg))
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
        context('using explicit count', async () => {
            async function makeQuery(pageSize: any) {
                return request
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
                const response = await makeQuery('not_a_number')
                await failsValidation(response)
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

        it('supports filtering on expected fields', async () => {
            const query = `
                query usersConnection($filter: UserFilter) {
                    usersConnection(direction: FORWARD, filter: $filter){
                        totalCount
                    }
                }`

            const uuidFilter = {
                operator: 'eq',
                value: v4(),
            }
            const stringFilter = {
                operator: 'eq',
                value: 'doesnt matter',
            }

            const response = await makeRequest(
                request,
                query,
                {
                    filter: {
                        userId: uuidFilter,
                        userStatus: {
                            operator: 'eq',
                            value: 'active',
                        },
                        givenName: stringFilter,
                        familyName: stringFilter,
                        avatar: stringFilter,
                        email: stringFilter,
                        phone: stringFilter,
                        username: stringFilter,
                        organizationId: uuidFilter,
                        roleId: uuidFilter,
                        schoolId: uuidFilter,
                        organizationUserStatus: {
                            operator: 'eq',
                            value: 'active',
                        },
                        classId: uuidFilter,
                        gradeId: uuidFilter,
                    },
                },
                getAdminAuthToken()
            )
            expect(response.statusCode).to.eq(200)
            expect(response.body.errors).to.be.undefined
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

            expect(response.status).to.eq(200)
            expect(response.body.errors.length).to.equal(1)
            expect(response.body.errors[0]['message']).to.equal(
                'No authentication token'
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

    context('addOrganizationRolesToUser', () => {
        let input: AddOrganizationRolesToUserInput[]

        beforeEach(async () => {
            const roles = []
            for (let i = 0; i < rolesCount; i++) {
                roles.push(createRole(`Role ${i}`))
            }
            await Role.save(roles)

            input = []
            for (const membership of memberships) {
                input.push({
                    userId: membership.user_id,
                    organizationId: membership.organization_id,
                    roleIds: roles.slice(3, 11).map((v) => v.role_id),
                })
            }
        })

        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: ADD_ORG_ROLES_TO_USERS,
                        variables: {
                            input,
                        },
                    })

                const resUsers: UserConnectionNode[] =
                    response.body.data.addOrganizationRolesToUsers.users
                expect(response.status).to.eq(200)
                expect(resUsers.length).to.equal(usersCount)
            })
        })
    })
    context('createUsers', async () => {
        let myUser: User
        let myOrg: Organization
        let token: string
        let createUserInputs: CreateUserInput[] = []
        beforeEach(async () => {
            myUser = await createUser().save()
            myOrg = await createOrganization().save()
            const role = await createRole(undefined, myOrg, {
                permissions: [PermissionName.create_users_40220],
            }).save()
            await createOrganizationMembership({
                user: myUser,
                organization: myOrg,
                roles: [role],
            }).save()
            token = generateToken({
                id: myUser.user_id,
                email: myUser.email,
                iss: 'calmid-debug',
            })
            createUserInputs = [
                ...Array(config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE),
            ].map((_) => userToCreateUserInput(createUser()))
        })
        it(`Creates ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE} users`, async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: token,
                })
                .send({
                    query: CREATE_USERS,
                    variables: { input: createUserInputs },
                })

            expect(response.status).to.eq(200)
            expect(response.body.errors).to.equal(undefined)
            expect(response.body.data.createUsers.users.length).to.equal(
                createUserInputs.length
            )
        })
    })

    context('updateUsers', async () => {
        let myUser: User
        let myOrg: Organization
        let token: string
        let updateUserInputs: UpdateUserInput[] = []
        beforeEach(async () => {
            myUser = await createUser().save()
            myOrg = await createOrganization().save()
            const role = await createRole(undefined, myOrg, {
                permissions: [PermissionName.edit_users_40330],
            }).save()
            await createOrganizationMembership({
                user: myUser,
                organization: myOrg,
                roles: [role],
            }).save()
            token = generateToken({
                id: myUser.user_id,
                email: myUser.email,
                iss: 'calmid-debug',
            })
            updateUserInputs = []
            for (
                let i = 0;
                i < config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE;
                i++
            ) {
                const u = await createUser().save()
                updateUserInputs.push(
                    randomChangeToUpdateUserInput(userToUpdateUserInput(u))
                )
            }
        })
        it(`Updates ${config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE} users`, async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: token,
                })
                .send({
                    query: UPDATE_USERS,
                    variables: { input: updateUserInputs },
                })

            expect(response.status).to.eq(200)
            expect(response.body.errors).to.equal(undefined)
            const userConNodes: CoreUserConnectionNode[] = response.body.data.updateUsers.users.map(
                (u: UserConnectionNode) => extractCoreUserConnectionNode(u)
            )
            expect(userConNodes.length).to.equal(updateUserInputs.length)
            const inputUserIds = updateUserInputs.map((uui) => uui.id)
            const currentUsers = await connection.manager
                .createQueryBuilder(User, 'User')
                .where('User.user_id IN (:...ids)', { ids: inputUserIds })
                .getMany()
            const currentUserNodes: CoreUserConnectionNode[] = []
            currentUsers.map((u) =>
                currentUserNodes.push(mapUserToUserConnectionNode(u))
            )
            userConNodes.sort((a, b) =>
                a.id < b.id ? -1 : a.id > b.id ? 1 : 0
            )
            currentUserNodes.sort((a, b) =>
                a.id < b.id ? -1 : a.id > b.id ? 1 : 0
            )
            expect(currentUserNodes).to.deep.equal(userConNodes)
        })
    })

    context('removeOrganizationRolesFromUser', () => {
        let input: RemoveOrganizationRolesFromUserInput[]

        beforeEach(async () => {
            const roles = createRoles(rolesCount)
            await Role.save(roles)

            input = []
            for (const membership of memberships) {
                membership.roles = Promise.resolve(roles.slice(3, 17))
                await membership.save()
                input.push({
                    userId: membership.user_id,
                    organizationId: membership.organization_id,
                    roleIds: roles.slice(8, 17).map((v) => v.role_id),
                })
            }
        })

        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: REMOVE_ORG_ROLES_FROM_USERS,
                        variables: {
                            input,
                        },
                    })

                const resUsers: UserConnectionNode[] =
                    response.body.data.removeOrganizationRolesFromUsers.users
                expect(response.status).to.eq(200)
                expect(resUsers.length).to.equal(usersCount)
            })
        })
    })

    context('addSchoolRolesToUsers', () => {
        let adminUser: User
        let input: AddSchoolRolesToUserInput[]

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const org = await createOrganization().save()
            const roles = createRoles(2)
            roles.forEach((r) => (r.organization = Promise.resolve(org)))
            users = createUsers(2)
            await connection.manager.save([...roles, ...users])
            const school = await createSchool(org).save()

            schoolMemberships = []
            input = []
            for (const user of users) {
                schoolMemberships.push(
                    createSchoolMembership({
                        user,
                        school,
                        roles: [],
                    })
                )
                input.push({
                    userId: user.user_id,
                    schoolId: school.school_id,
                    roleIds: roles.map((role) => role.role_id),
                })
            }
            await SchoolMembership.save(schoolMemberships)
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                ADD_SCHOOL_ROLES_TO_USERS,
                { input },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(200)
            const resUsers: UserConnectionNode[] =
                response.body.data.addSchoolRolesToUsers.users
            expect(resUsers).to.have.length(users.length)
            expect(resUsers).to.deep.equalInAnyOrder(
                users.map((user) => mapUserToUserConnectionNode(user))
            )
        })

        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                ADD_SCHOOL_ROLES_TO_USERS,
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(3)
            expect(response.body.errors[0].message).to.contain(
                'Field "userId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "schoolId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[2].message).to.contain(
                'Field "roleIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('removeSchoolRolesFromUsers', () => {
        let adminUser: User
        let input: RemoveSchoolRolesFromUserInput[]
        const schoolCount = 5

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const roles = createRoles(rolesCount)
            users = createUsers(usersCount)
            await connection.manager.save([...roles, ...users])
            const org = await createOrganization().save()
            const schools = createSchools(schoolCount, org)
            await School.save(schools)

            schoolMemberships = []
            input = []
            for (const [index, school] of schools.entries()) {
                const user = users[index % users.length] // just in case schoolCount > userCount
                schoolMemberships.push(
                    createSchoolMembership({
                        user,
                        school,
                        roles: roles,
                    })
                )
                input.push({
                    userId: user.user_id,
                    schoolId: school.school_id,
                    roleIds: roles.map((r) => r.role_id),
                })
            }
            await SchoolMembership.save(schoolMemberships)
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                REMOVE_SCHOOL_ROLES_FROM_USERS,
                { input },
                generateToken(userToPayload(adminUser))
            )
            const resUsers: UserConnectionNode[] =
                response.body.data.removeSchoolRolesFromUsers.users
            expect(response.status).to.eq(200)
            expect(resUsers.length).to.equal(schoolCount)
        })

        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                REMOVE_SCHOOL_ROLES_FROM_USERS,
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(3)
            expect(response.body.errors[0].message).to.contain(
                'Field "userId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "schoolId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[2].message).to.contain(
                'Field "roleIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('eligibleStudentsConnection', () => {
        it('supports filtering on expected fields', async () => {
            const query = `query(
                $classId: ID!,
                $filter: EligibleMembersFilter){
                eligibleStudentsConnection(
                    classId: $classId,
                    direction: FORWARD,
                    filter: $filter){
                    totalCount
                }
            }`

            const stringFilter = {
                operator: 'eq',
                value: 'doesnt matter',
            }

            const response = await makeRequest(
                request,
                query,
                {
                    classId: v4(),
                    filter: {
                        givenName: stringFilter,
                        familyName: stringFilter,
                        email: stringFilter,
                        phone: stringFilter,
                        username: stringFilter,
                    },
                },
                getAdminAuthToken()
            )
            expect(response.statusCode).to.eq(200)
            expect(response.body.errors).to.be.undefined
        })

        context('When a user has permission', () => {
            it('should find some eligibleStudents', async () => {
                const response = await makeRequest(
                    request,
                    ELIGIBLE_STUDENTS_CONNECTION,
                    {
                        classId: classIds[0],
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                    },
                    getAdminAuthToken()
                )
                expect(
                    response.body.data.eligibleStudentsConnection.edges.length
                ).equals(users.length - students.length)
            })
        })
        context('When a user does not have membership', () => {
            let token: string
            let testUser: User
            beforeEach(async () => {
                testUser = await createUser().save()

                token = generateToken({
                    id: testUser.user_id,
                    email: testUser.email,
                    iss: 'calmid-debug',
                })
            })
            it('should find no users', async () => {
                const response = await makeRequest(
                    request,
                    ELIGIBLE_STUDENTS_CONNECTION,
                    {
                        classId: classIds[0],
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                    },
                    token
                )
                expect(response.status).to.eq(200)
                expect(
                    response.body.data.eligibleStudentsConnection.edges.length
                ).equals(0)
            })
        })
        context('When a user has membership but no role', () => {
            let token: string
            let testUser: User
            beforeEach(async () => {
                testUser = await createUser().save()
                await createOrganizationMembership({
                    user: testUser,
                    organization,
                }).save()
                token = generateToken({
                    id: testUser.user_id,
                    email: testUser.email,
                    iss: 'calmid-debug',
                })
            })
            it('should find no users', async () => {
                const response = await makeRequest(
                    request,
                    ELIGIBLE_STUDENTS_CONNECTION,
                    {
                        classId: classIds[0],
                        direction: 'FORWARD',
                        directionArgs: {
                            count: 50,
                        },
                    },
                    token
                )
                expect(response.status).to.eq(200)
                expect(
                    response.body.data.eligibleStudentsConnection.edges.length
                ).equals(0)
            })
        })
        context(
            'When the calling user has membership with a role with only attend_live_class_as_a_student_187 permission',
            () => {
                let token: string
                let testUser: User
                beforeEach(async () => {
                    testUser = await createUser().save()
                    await createOrganizationMembership({
                        user: testUser,
                        organization,
                        roles: [simpleStudentRole],
                    }).save()
                    token = generateToken({
                        id: testUser.user_id,
                        email: testUser.email,
                        iss: 'calmid-debug',
                    })
                })
                it('should find only that one same user', async () => {
                    const response = await makeRequest(
                        request,
                        ELIGIBLE_STUDENTS_CONNECTION,
                        {
                            classId: classIds[0],
                            direction: 'FORWARD',
                            directionArgs: {
                                count: 50,
                            },
                        },
                        token
                    )
                    expect(response.status).to.eq(200)
                    const edges =
                        response.body.data.eligibleStudentsConnection.edges
                    expect(edges.length).equals(1)
                    const found = edges[0].node
                    expect(found.id).equals(testUser.user_id)
                })
            }
        )
        context(
            'When the calling user has membership with a role with the permission view_users_40110',
            () => {
                let token: string
                let testUser: User
                beforeEach(async () => {
                    testUser = await createUser().save()
                    const orgViewerRole = await createRole(
                        undefined,
                        organization,
                        {
                            permissions: [PermissionName.view_users_40110],
                        }
                    ).save()
                    if (orgViewerRole) {
                        await createOrganizationMembership({
                            user: testUser,
                            organization,
                            roles: [orgViewerRole],
                        }).save()
                    }
                    token = generateToken({
                        id: testUser.user_id,
                        email: testUser.email,
                        iss: 'calmid-debug',
                    })
                })
                it('should return a full page of users as the calling user has permission', async () => {
                    const response = await makeRequest(
                        request,
                        ELIGIBLE_STUDENTS_CONNECTION,
                        {
                            classId: classIds[0],
                            direction: 'FORWARD',
                            directionArgs: {
                                count: 50,
                            },
                        },
                        token
                    )
                    expect(response.status).to.eq(200)
                    expect(
                        response.body.data.eligibleStudentsConnection.edges
                            .length
                    ).equals(users.length - students.length)
                })
            }
        )
        context(
            'When the calling user has membership with a role with the permission view_my_school_users_40111',
            () => {
                let token: string
                let testUser: User
                beforeEach(async () => {
                    const school = await createSchool(organization).save()
                    testUser = await createUser().save()

                    await createSchoolMembership({
                        user: testUser,
                        school: school,
                    }).save()

                    const schoolViewerRole = await createRole(
                        undefined,
                        organization,
                        {
                            permissions: [
                                PermissionName.view_my_school_users_40111,
                            ],
                        }
                    ).save()

                    await createOrganizationMembership({
                        user: testUser,
                        organization,
                        roles: [schoolViewerRole],
                    }).save()

                    await createSchoolMembership({
                        user: testUser,
                        school: school,
                    }).save()

                    const promiseSchoolMemberships = []
                    for (let i = 0; i < 5; i++) {
                        promiseSchoolMemberships.push(
                            createSchoolMembership({
                                user: users[i],
                                school: school,
                            }).save()
                        )
                    }
                    await Promise.all(promiseSchoolMemberships)

                    token = generateToken({
                        id: testUser.user_id,
                        email: testUser.email,
                        iss: 'calmid-debug',
                    })
                })

                it('should find only the users enrolled in their school', async () => {
                    const response = await makeRequest(
                        request,
                        ELIGIBLE_STUDENTS_CONNECTION,
                        {
                            classId: classIds[0],
                            direction: 'FORWARD',
                            directionArgs: {
                                count: 50,
                            },
                        },
                        token
                    )
                    expect(response.status).to.eq(200)
                    expect(
                        response.body.data.eligibleStudentsConnection.edges
                            .length
                    ).equals(5 - students.length)
                })
            }
        )
    })
})
