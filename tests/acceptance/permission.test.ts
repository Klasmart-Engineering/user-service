import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Permission } from '../../src/entities/permission'
import { PERMISSIONS_CONNECTION } from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { User } from '../../src/entities/user'
import { Organization } from '../../src/entities/organization'
import { createUser } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { PERMISSIONS_CONNECTION_COLUMNS } from '../../src/pagination/permissionsConnection'
import { userToPayload } from '../utils/operations/userOps'

const url = 'http://localhost:8080'
const request = supertest(url)
let organizationMember: User
let organization: Organization

describe('acceptance.permission', () => {
    let connection: Connection
    let permissionsCount: number

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        permissionsCount = await Permission.createQueryBuilder('Permission')
            .select(PERMISSIONS_CONNECTION_COLUMNS)
            .innerJoin('Permission.roles', 'Role')
            .getCount()

        organizationMember = await createUser().save()
        organization = await createOrganization(organizationMember).save()

        await connection.manager.save(
            createOrganizationMembership({
                user: organizationMember,
                organization,
            })
        )
    })

    context('when data is requested in a correct way', () => {
        it('should response with status 200', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(
                        userToPayload(organizationMember)
                    ),
                })
                .send({
                    query: print(PERMISSIONS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const permissionsConnection =
                response.body.data.permissionsConnection

            expect(response.status).to.eq(200)
            expect(permissionsConnection.totalCount).to.equal(permissionsCount)
        })
    })

    context('when data is requested in an incorrect way', () => {
        it('should response with status 400', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(
                        userToPayload(organizationMember)
                    ),
                })
                .send({
                    query: print(PERMISSIONS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: { field: 'byId', order: 'ASC' },
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
