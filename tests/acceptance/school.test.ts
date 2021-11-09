import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { expect, use } from 'chai'
import { before } from 'mocha'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { generateToken } from '../utils/testConfig'
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

async function createUserInSchool() {
    const user = await createUser().save()
    const organization = await createOrganization().save()
    const role = await createRole('viewSchool', organization, {
        permissions: [PermissionName.view_school_20110],
    }).save()

    await createOrganizationMembership({
        user,
        organization,
        roles: [role],
    }).save()

    const school = await createSchool(organization).save()

    await createSchoolMembership({
        user,
        school,
    }).save()

    return { user, school }
}

describe('acceptance.school', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('schoolsConnection', () => {
        it('has classesConnection as a child', async () => {
            const query = `
                query schoolConnection($direction: ConnectionDirection!) {
                    schoolConnection(direction:$direction){
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

            const { user, school } = await createUserInSchool()

            const _class = await createClass([school]).save()

            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                query,
                {
                    direction: 'FORWARD',
                },
                token
            )

            expect(response.status).to.eq(200)

            expect(
                response.body.data.schoolsConnection.edges[0].node
                    .usersConnection.edges[0].node.id
            ).to.eq(_class.class_id)
        })
    })
})