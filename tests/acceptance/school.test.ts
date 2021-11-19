import supertest from 'supertest'
import { Connection } from 'typeorm'
import { School } from '../../src/entities/school'
import { SCHOOLS_CONNECTION, SCHOOL_NODE } from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { expect } from 'chai'
import { NIL_UUID } from '../utils/database'
import {
    createOrg,
    createSchool,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { createSchool as createFactorySchool } from '../factories/school.factory'
import { loadFixtures } from '../utils/fixtures'
import { Organization } from '../../src/entities/organization'
import { createOrganization } from '../factories/organization.factory'
import { Class } from '../../src/entities/class'
import { createClass } from '../factories/class.factory'
import { User } from '../../src/entities/user'
import { createUser } from '../factories/user.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { makeRequest } from './utils'

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
        let wizardingSchool: School
        let wizardOrg: Organization
        let potionsClass: Class
        let wizardUser: User

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

        it('has classesConnection as a child', async () => {
            const query = `
                query schoolsConnection($direction: ConnectionDirection!) {
                    schoolsConnection(direction:$direction){
                        edges {
                            node {
                                classesConnection{
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

            wizardUser = await createUser().save()
            wizardOrg = await createOrganization().save()
            wizardingSchool = await createFactorySchool(
                wizardOrg,
                'Hogwarts'
            ).save()
            potionsClass = await createClass(
                [wizardingSchool],
                wizardOrg
            ).save()
            const role = await createRole(undefined, undefined, {
                permissions: [
                    PermissionName.view_school_20110,
                    PermissionName.view_school_classes_20117,
                ],
            }).save()

            await createOrganizationMembership({
                user: wizardUser,
                organization: wizardOrg,
                roles: [role],
            }).save()
            await createSchoolMembership({
                user: wizardUser,
                school: wizardingSchool,
            }).save()

            const token = generateToken({
                id: wizardUser.user_id,
                email: wizardUser.email,
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
            expect(
                response.body.data.schoolsConnection.edges[0].node
                    .classesConnection.edges[0].node.id
            ).to.eq(potionsClass.class_id)
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
