import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Role } from '../../src/entities/role'
import { createOrganization } from '../factories/organization.factory'
import { loadFixtures } from '../utils/fixtures'
import { ROLES_CONNECTION, ROLE_NODE } from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { createRole } from '../factories/role.factory'
import {
    DeleteRoleInput,
    RoleConnectionNode,
} from '../../src/types/graphQL/role'
import { NIL_UUID } from '../utils/database'
import { print } from 'graphql'
import { createUser } from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { makeRequest } from './utils'
import { createPermission } from '../factories/permission.factory'
import { DELETE_ROLES } from '../utils/operations/roleOps'
import { User } from '../../src/entities/user'
import { PermissionName } from '../../src/permissions/permissionNames'
import { userToPayload } from '../utils/operations/userOps'

interface IRoleEdge {
    node: RoleConnectionNode
}

describe('acceptance.role', () => {
    let connection: Connection
    let systemRolesCount = 0
    let orgRoles: Role[]
    let orgAdmin: User
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

        orgAdmin = await createUser().save()
        const organization = await createOrganization(orgAdmin).save()
        const roleForDeleteRoles = await createRole(
            'Delete Roles',
            organization,
            { permissions: [PermissionName.delete_role_30440] }
        ).save()

        await createOrganizationMembership({
            user: orgAdmin,
            organization,
            roles: [roleForDeleteRoles],
        }).save()

        for (let i = 1; i <= rolesCount; i++) {
            const role = createRole(`role ${i}`, organization)
            role.system_role = true
            await role.save()
        }

        orgRoles = await Role.save(
            Array.from(new Array(rolesCount), (_, i) =>
                createRole(`role ${i + 1}`, organization)
            )
        )

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

    it('has permissionsConnection as a child', async () => {
        const user = await createUser().save()
        const organization = await createOrganization(user).save()
        await createOrganizationMembership({
            user,
            organization,
        }).save()

        const role = await createRole('role x', organization).save()
        const permission = await createPermission(role).save()
        ;(await role.permissions)?.push(permission)
        await role.save()

        const token = generateToken({
            id: user.user_id,
            email: user.email,
            iss: 'calmid-debug',
        })

        const query = `
        query {
            rolesConnection(direction: FORWARD, filter: {name: {operator: eq, value: "${role.role_name}"}}) {                   
                edges {
                    node {
                        permissionsConnection(direction: FORWARD){
                            totalCount                              
                            edges {                                 
                                node {
                                    id
                                }
                            }
                        }
                    }
                }
    
            }
        }`

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
            response.body.data.rolesConnection.edges[0].node
                .permissionsConnection.edges[0].node.id
        ).to.eq(permission.permission_id)
    })

    context('deleteRoles', () => {
        const makeDeleteRolesMutation = async (input: DeleteRoleInput[]) => {
            return await makeRequest(
                request,
                print(DELETE_ROLES),
                { input },
                generateToken(userToPayload(orgAdmin))
            )
        }

        context('when input is sent in a correct way', () => {
            it('should respond successfully', async () => {
                const input = [
                    {
                        id: orgRoles[0].role_id,
                    },
                ]

                const response = await makeDeleteRolesMutation(input)
                const roles = response.body.data.deleteRoles.roles

                expect(response.status).to.eq(200)
                expect(roles).to.exist
                expect(roles).to.be.an('array')
                expect(roles).to.have.lengthOf(input.length)

                const inputIds = input.map((i) => i.id)
                const roleDeletedIds = roles.map(
                    (rd: RoleConnectionNode) => rd.id
                )

                expect(roleDeletedIds).to.deep.equalInAnyOrder(inputIds)
            })
        })

        context('when id in input does not exist', () => {
            it('should respond with errors', async () => {
                const input = [
                    {
                        id: NIL_UUID,
                    },
                ]

                const response = await makeDeleteRolesMutation(input)
                const rolesDeleted = response.body.data.deleteRoles
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(rolesDeleted).to.be.null
                expect(errors).to.exist
            })
        })
    })
})
