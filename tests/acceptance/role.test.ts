import { expect } from 'chai'
import faker from 'faker'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Role } from '../../src/entities/role'
import { createOrganization } from '../factories/organization.factory'
import { loadFixtures } from '../utils/fixtures'
import { ROLES_CONNECTION, ROLE_NODE } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { createRole } from '../factories/role.factory'
import { RoleConnectionNode } from '../../src/types/graphQL/role'
import { NIL_UUID } from '../utils/database'
import { print } from 'graphql'

interface IRoleEdge {
    node: RoleConnectionNode
}

describe('acceptance.role', () => {
    let connection: Connection
    let systemRolesCount = 0
    const url = 'http://localhost:8080/user'
    const request = supertest(url)
    const rolesCount = 12

    async function makeConnectionQuery(pageSize: number) {
        return await request
            .post('/user')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: print(ROLES_CONNECTION),
                variables: {
                    direction: 'FORWARD',
                    directionArgs: {
                        count: pageSize,
                    },
                },
            })
    }

    async function makeNodeQuery(id: string) {
        return await request
            .post('/user')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: print(ROLE_NODE),
                variables: {
                    id,
                },
            })
    }

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
        it('queries paginated roles', async () => {
            const pageSize = 5

            const response = await makeConnectionQuery(pageSize)

            const rolesConnection = response.body.data.rolesConnection

            expect(response.status).to.eq(200)
            expect(rolesConnection.totalCount).to.equal(systemRolesCount)
            expect(rolesConnection.edges.length).to.equal(pageSize)
        })
        it('fails validation', async () => {
            const pageSize = 'not_a_number'
            const response = await makeConnectionQuery(pageSize as any)

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

    context('roleNode', () => {
        let roles: IRoleEdge[]

        beforeEach(async () => {
            const rolesResponse = await makeConnectionQuery(10)
            roles = rolesResponse.body.data.rolesConnection.edges
        })

        context('when requested role exists', () => {
            it('responds successfully', async () => {
                const role = roles[0].node
                const response = await makeNodeQuery(role.id)
                const roleNode = response.body.data.roleNode

                expect(response.status).to.eq(200)
                expect(roleNode.id).to.equal(role.id)
                expect(roleNode.name).to.equal(role.name)
                expect(roleNode.description).to.equal(role.description)
                expect(roleNode.status).to.equal(role.status)
                expect(roleNode.system).to.equal(role.system)
            })
        })

        context('when requested role does not exists', () => {
            it('responds with errors', async () => {
                const roleId = NIL_UUID
                const response = await makeNodeQuery(roleId)
                const roleNode = response.body.data.roleNode
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(roleNode).to.be.null
                expect(errors).to.exist
            })
        })
    })
})
