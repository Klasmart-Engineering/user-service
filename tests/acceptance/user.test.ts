import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import {
    addStudentsToClass,
    inviteUserToOrganization,
    createClass,
    createOrg,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { User } from '../../src/entities/user'
import { USERS_CONNECTION } from '../utils/operations/modelOps'

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

        for (let i = 0; i < usersCount; i++) {
            const response = await inviteUserToOrganization(
                `user${i + 1}@gmail.com`,
                orgId,
                getAdminAuthToken()
            )

            const id = response.body.data.organization.inviteUser.user.user_id
            userIds.push(id)
        }

        for (let i = 0; i < classesCount; i++) {
            const uIds = [
                userIds[i * 3],
                userIds[i * 3 + 1],
                userIds[i * 3 + 2],
            ]
            const classResponse = await createClass(
                orgId,
                `class ${i + 1}`,
                getAdminAuthToken()
            )

            const classId =
                classResponse.body.data.organization.createClass.class_id

            classIds.push(classId)
            await addStudentsToClass(classId, uIds, getAdminAuthToken())
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
            expect(usersConnection.totalCount).to.equal(3)
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
    })
})
