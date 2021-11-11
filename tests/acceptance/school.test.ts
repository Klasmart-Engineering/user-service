import supertest from 'supertest'
import { Connection } from 'typeorm'
import { School } from '../../src/entities/school'
import { SCHOOLS_CONNECTION, SCHOOL_NODE } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { expect } from 'chai'
import { NIL_UUID } from '../utils/database'
import {
    createOrg,
    createSchool,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { loadFixtures } from '../utils/fixtures'

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'

async function makeConnectionQuery() {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: SCHOOLS_CONNECTION,
            variables: {
                direction: 'FORWARD',
            },
        })
}

const makeNodeQuery = async (id: string) => {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: print(SCHOOL_NODE),
            variables: {
                id,
            },
        })
}

describe('acceptance.school', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    beforeEach(async () => {
        await loadFixtures('users', connection)
        const createOrgResponse = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )
        const {
            organization_id,
        } = createOrgResponse.body.data.user.createOrganization
        await createSchool(organization_id, `school x`, getAdminAuthToken())
    })

    after(async () => {
        await connection?.close()
    })

    context('schoolsConnection', () => {
        let schoolsCount: number

        beforeEach(async () => {
            schoolsCount = await School.count()
        })

        context('when data is requested in a correct way', () => {
            it('should response with status 200', async () => {
                const response = await makeConnectionQuery()
                const schoolsConnection = response.body.data.schoolsConnection

                expect(response.status).to.eq(200)
                expect(schoolsConnection.totalCount).to.equal(schoolsCount)
            })
        })

        context('when data is requested in an incorrect way', () => {
            it('should response with status 400', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: SCHOOLS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                byStatus: {
                                    operator: 'eq',
                                    value: 'available',
                                },
                            },
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

    context('schoolNode', () => {
        context('when requested school exists', () => {
            it('should respond succesfully', async () => {
                const schoolResponse = await makeConnectionQuery()
                const schoolsEdges =
                    schoolResponse.body.data.schoolsConnection.edges
                const schoolId = schoolsEdges[0].node.id
                const response = await makeNodeQuery(schoolId)
                const schoolNode = response.body.data.schoolNode

                expect(response.status).to.eq(200)
                expect(schoolNode.id).to.equal(schoolId)
            })
        })

        context('when requested school does not exists', () => {
            it('should respond with errors', async () => {
                const response = await makeNodeQuery(NIL_UUID)
                const errors = response.body.errors
                const schoolNode = response.body.data.schoolNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(schoolNode).to.be.null
            })
        })
    })
})
