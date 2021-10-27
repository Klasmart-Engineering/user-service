import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { createSchool } from '../utils/operations/acceptance/acceptanceOps.test'
import { SCHOOL_NODE } from '../utils/operations/modelOps'
import { CREATE_ORGANIZATION } from '../utils/operations/userOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'

const url = 'http://localhost:8080'
const request = supertest(url)
let org1Id: string

async function createOrg(user_id: string, org_name: string, token: string) {
    return await request
        .post('/user')
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

describe('acceptance.school', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('schoolNode', () => {
        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
                const org_name = 'my-org'
                const createOrg1Response = await createOrg(
                    user_id,
                    org_name,
                    getAdminAuthToken()
                )
                const createOrg1Data =
                    createOrg1Response.body.data.user.createOrganization

                org1Id = createOrg1Data.organization_id
                const createSchoolResponse = await createSchool(
                    org1Id,
                    `school`,
                    getAdminAuthToken()
                )

                const createSchoolData =
                    createSchoolResponse.body.data.organization.createSchool

                const schoolId = createSchoolData.school_id
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(SCHOOL_NODE),
                        variables: {
                            id: schoolId,
                        },
                    })

                const schoolNode = response.body.data.schoolNode

                expect(response.status).to.eq(200)
                expect(schoolNode.id).to.equal(schoolId)
            })
        })

        context('when data is not requested in a correct way', () => {
            it('should respond with status 400', async () => {
                const schoolId = '7h15-15-n07-4n-1d'
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(SCHOOL_NODE),
                        variables: {
                            schoolId,
                        },
                    })

                const errors = response.body.errors
                const data = response.body.data

                expect(response.status).to.eq(400)
                expect(errors).to.exist
                expect(data).to.be.undefined
            })
        })
    })
})
