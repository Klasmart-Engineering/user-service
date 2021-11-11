import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { expect, use } from 'chai'
import { before } from 'mocha'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createSchool } from '../factories/school.factory'
import { createUser } from '../factories/user.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createClass } from '../factories/class.factory'
import { createAdminUser } from '../utils/testEntities'
import { School } from '../../src/entities/school'
import { createTestClient } from '../utils/createTestClient'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)

async function makeRequest(
    query: string,
    variables: Record<string, unknown>,
    token?: string
) {
    return request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })

        .send({
            query,
            variables,
        })
}


describe('acceptance.organization', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
        testClient = await createTestClient()
    })

    after(async () => {
        await connection?.close()
    })

    context('schoolsConnection', () => {
        it('has classesConnection as a child', async () => {
            const query = `
                query organizationConnection($direction: ConnectionDirection!) {
                    organizationConnection(direction:$direction){
                        edges {
                            node {
                                classesChildConnection{
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

            const org1 = await createOrganization().save()
            const org2 = await createOrganization().save()

            const _class1 = await createClass([],org1).save()
            const _class2 = await createClass([],org1).save()

            const _class3 = await createClass([],org2).save()
            const _class4 = await createClass([],org2).save()


            const response = await makeRequest(
                query,
                {
                    direction: 'FORWARD',
                },
                getAdminAuthToken()
            )

            expect(response.status).to.eq(200)

            expect(
                response.body.data.organizationConnection.edges[0].node
                    .organizationConnection.edges[0].node.id
            ).to.eq(_class.class_id)
        })
    })
})