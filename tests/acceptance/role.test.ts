import { expect } from 'chai'
import faker from 'faker'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Role } from '../../src/entities/role'
import { createOrganization } from '../factories/organization.factory'
import { loadFixtures } from '../utils/fixtures'
import { ROLES_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { createRole } from '../factories/role.factory'

describe('acceptance.role', () => {
    let connection: Connection
    let systemRolesCount = 0
    const url = 'http://localhost:8080/user'
    const request = supertest(url)
    const rolesCount = 12
    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await loadFixtures('users', connection)

        const organization = createOrganization()

        for (let i = 1; i <= rolesCount; i++) {
            const role = createRole(`role ${i}`, organization)
            role.system_role = true
            await role.save()
        }

        for (let i = 1; i <= rolesCount; i++) {
            await createRole(`role ${i}`, organization).save()
        }

        systemRolesCount = await connection.manager.count(Role, {
            where: { system_role: true },
        })
    })

    context('rolesConnection', () => {
        async function makeQuery(pageSize: any) {
            return await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: ROLES_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        directionArgs: {
                            count: pageSize,
                        },
                    },
                })
        }
        it('queries paginated roles', async () => {
            const pageSize = 5

            const response = await makeQuery(pageSize)

            const rolesConnection = response.body.data.rolesConnection

            expect(response.status).to.eq(200)
            expect(rolesConnection.totalCount).to.equal(systemRolesCount)
            expect(rolesConnection.edges.length).to.equal(pageSize)
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
})
