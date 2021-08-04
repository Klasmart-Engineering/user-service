import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Class } from '../../src/entities/class'
import { Status } from '../../src/entities/status'
import { User } from '../../src/entities/user'
import { loadFixtures } from '../utils/fixtures'
import {
    addSchoolToClass,
    createSchool,
    inviteUserToOrganization,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { DELETE_CLASS } from '../utils/operations/classOps'
import { CLASSES_CONNECTION } from '../utils/operations/modelOps'
import {
    CREATE_CLASS,
    getSystemRoleIds,
} from '../utils/operations/organizationOps'
import { CREATE_ORGANIZATION, userToPayload } from '../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

let schoolAdminId: string
let orgMemberId: string
let schoolIds: string[] = []
const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const user2_id = '16046442-75b8-4da5-b3df-aa53a70a13a1'
const org2_name = 'my-org2'
const classesCount = 12
const schoolsCount = 2

let user2: User
let schoolAdmin: User
let orgMember: User
let org1Id: string
let org2Id: string

async function createOrg(user_id: string, org_name: string, token: string) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_ORGANIZATION,
            variables: {
                user_id,
                org_name,
            },
        })
}

async function createClass(
    organization_id: string,
    class_name: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_CLASS,
            variables: {
                organization_id,
                class_name,
            },
        })
}

async function deleteClass(classId: string, token: string) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: DELETE_CLASS,
            variables: {
                class_id: classId,
            },
        })
}

describe('acceptance.class', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        const systemRoles = await getSystemRoleIds()
        const schoolAdminRoleId = String(systemRoles['School Admin'])

        schoolIds = []

        await loadFixtures('users', connection)
        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        org1Id = createOrg1Data.organization_id

        user2 = await connection.manager.findOneOrFail(User, user2_id)

        const createOrg2Response = await createOrg(
            user2_id,
            org2_name,
            generateToken(userToPayload(user2))
        )

        const createOrg2Data =
            createOrg2Response.body.data.user.createOrganization

        org2Id = createOrg2Data.organization_id

        for (let i = 1; i <= schoolsCount; i++) {
            const createSchoolResponse = await createSchool(
                org1Id,
                `school ${i}`,
                getAdminAuthToken()
            )

            const createSchoolData =
                createSchoolResponse.body.data.organization.createSchool

            schoolIds.push(createSchoolData.school_id)
        }

        const createSchoolAdminResponse = await inviteUserToOrganization(
            'school',
            'admin',
            'school.admin@gmail.com',
            org1Id,
            getAdminAuthToken(),
            [schoolAdminRoleId],
            [schoolAdminRoleId],
            [schoolIds[0]]
        )

        const createSchoolAdminData =
            createSchoolAdminResponse.body.data.organization.inviteUser

        schoolAdminId = createSchoolAdminData.user.user_id
        schoolAdmin = await connection.manager.findOneOrFail(
            User,
            schoolAdminId
        )

        const createOrgMemberResponse = await inviteUserToOrganization(
            'organization',
            'member',
            'org.member@gmail.com',
            org1Id,
            getAdminAuthToken()
        )

        const createOrgMemberData =
            createOrgMemberResponse.body.data.organization.inviteUser

        orgMemberId = createOrgMemberData.user.user_id
        orgMember = await connection.manager.findOneOrFail(User, orgMemberId)

        for (let i = 1; i <= classesCount; i++) {
            const createClassResponse = await createClass(
                org1Id,
                `class ${i}`,
                getAdminAuthToken()
            )

            const createClassData =
                createClassResponse.body.data.organization.createClass

            await addSchoolToClass(
                createClassData.class_id,
                schoolIds[i % 2],
                getAdminAuthToken()
            )

            if (i > classesCount / 2) {
                await createClass(
                    org2Id,
                    `class ${i}`,
                    generateToken(userToPayload(user2))
                )
            }
        }

        const classes = await connection.manager.find(Class)
        const inactiveClassId = classes[0].class_id

        await deleteClass(inactiveClassId, getAdminAuthToken())
    })

    context('classesConnection', () => {
        it('queries paginated classes', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount)
        })

        it('queries paginated classes sorted by name', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'name',
                            order: 'ASC',
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount / 2)
        })

        it('queries paginated classes sorted by ID', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'id',
                            order: 'DESC',
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount)
        })

        it('queries paginated classes filtering by organization ID', async () => {
            const organizationId = org2Id

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount / 2)
        })

        it('queries paginated classes filtering by class status', async () => {
            const status = Status.INACTIVE

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            status: {
                                operator: 'eq',
                                value: status,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)
        })

        it("returns just the classes that belongs to user's school", async () => {
            const organizationId = org1Id

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(schoolAdmin)),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(
                classesCount / schoolsCount
            )
        })

        it('returns empty classes if the user has not permissions', async () => {
            const organizationId = org1Id

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(orgMember)),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(0)
        })

        it('returns empty classes if the user is not owner of the organization', async () => {
            const organizationId = org1Id

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(0)
        })

        it('responds with an error if the filter is wrong', async () => {
            const organizationId = 6

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CLASSES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            expect(response.status).to.eq(400)
            expect(response.body).to.have.property('errors')
        })
    })
})
