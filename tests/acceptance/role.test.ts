import { expect, use } from 'chai'
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
    UpdateRoleInput,
    CreateRoleInput,
    DeleteRoleInput,
    RoleConnectionNode,
} from '../../src/types/graphQL/role'
import { NIL_UUID } from '../utils/database'
import { print } from 'graphql'
import { createUser } from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { makeRequest } from './utils'
import { createPermission } from '../factories/permission.factory'
import { userToPayload } from '../utils/operations/userOps'
import { User } from '../../src/entities/user'
import {
    CREATE_ROLES,
    UPDATE_ROLES,
    DELETE_ROLES,
} from '../utils/operations/roleOps'
import { Organization } from '../../src/entities/organization'
import { PermissionName } from '../../src/permissions/permissionNames'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'

interface IRoleEdge {
    node: RoleConnectionNode
}

use(deepEqualInAnyOrder)

describe('acceptance.role', () => {
    let connection: Connection
    let systemRolesCount = 0
    let orgAdmin: User
    let organization: Organization
    let orgRoles: Role[]
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
        organization = await createOrganization(orgAdmin).save()

        const roleForCreateRoles = await createRole(
            'Create Roles',
            organization,
            { permissions: [PermissionName.create_role_with_permissions_30222] }
        ).save()

        const roleForUpdateRoles = await createRole(
            'Update Roles',
            organization,
            { permissions: [PermissionName.edit_role_and_permissions_30332] }
        ).save()

        const roleForDeleteRoles = await createRole(
            'Delete Roles',
            organization,
            { permissions: [PermissionName.delete_role_30440] }
        ).save()

        await createOrganizationMembership({
            user: orgAdmin,
            organization,
            roles: [roleForCreateRoles, roleForUpdateRoles, roleForDeleteRoles],
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

    context('createRoles', () => {
        const makeCreateRolesMutation = async (input: CreateRoleInput[]) => {
            return await makeRequest(
                request,
                print(CREATE_ROLES),
                { input },
                generateToken(userToPayload(orgAdmin))
            )
        }

        context('when input is sent in a correct way', () => {
            it('should respond successfully', async () => {
                const input = [
                    {
                        organizationId: organization.organization_id,
                        roleName: 'Custom Role',
                        roleDescription: 'This is a custom role',
                    },
                ]

                const response = await makeCreateRolesMutation(input)
                const { roles } = response.body.data.createRoles

                expect(response.status).to.eq(200)
                expect(roles).to.exist
                expect(roles).to.be.an('array')
                expect(roles).to.have.lengthOf(input.length)

                roles.forEach((r: RoleConnectionNode, i: number) => {
                    expect(r.name).to.equal(input[i].roleName)
                    expect(r.description).to.equal(input[i].roleDescription)
                })
            })
        })

        context('when organizationId in input does not exist', () => {
            it('should respond with errors', async () => {
                const input = [
                    {
                        organizationId: NIL_UUID,
                        roleName: 'Custom Role',
                        roleDescription: 'This is a custom role',
                    },
                ]

                const response = await makeCreateRolesMutation(input)
                const rolesCreated = response.body.data.createRoles
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(rolesCreated).to.be.null
                expect(errors).to.exist
            })
        })
    })

    context('updateRoles', () => {
        const makeUpdateRolesMutation = async (input: UpdateRoleInput[]) => {
            return await makeRequest(
                request,
                print(UPDATE_ROLES),
                { input },
                generateToken(userToPayload(orgAdmin))
            )
        }

        context('when input is sent in a correct way', () => {
            it('should respond successfully', async () => {
                const input = [
                    {
                        id: orgRoles[0].role_id,
                        roleName: 'Updated Role',
                        roleDescription: 'This role was updated',
                        permissionIds: [
                            PermissionName.edit_role_and_permissions_30332,
                        ],
                    },
                ]

                const response = await makeUpdateRolesMutation(input)
                const roles = response.body.data.updateRoles
                    .roles as RoleConnectionNode[]

                expect(response.status).to.eq(200)
                expect(roles).to.exist
                expect(roles).to.be.an('array')
                expect(roles).to.have.lengthOf(input.length)

                const rolesDB = await Role.findByIds(input.map((i) => i.id))
                expect(rolesDB).to.have.lengthOf(input.length)

                for (const rdb of rolesDB) {
                    const inputRelated = input.find(
                        (inp) => inp.id === rdb.role_id
                    ) as UpdateRoleInput

                    expect(inputRelated).to.exist
                    expect(rdb.role_name).to.equal(inputRelated.roleName)
                    expect(rdb.role_description).to.equal(
                        inputRelated.roleDescription
                    )

                    const rolePermissionIds = (await rdb.permissions)?.map(
                        (p) => p.permission_name
                    )

                    expect(rolePermissionIds).to.deep.equalInAnyOrder(
                        inputRelated.permissionIds
                    )
                }
            })
        })

        context('when id in input does not exist', () => {
            it('should respond with errors', async () => {
                const input = [
                    {
                        id: NIL_UUID,
                        roleName: 'Updated Role',
                        roleDescription: 'This role was updated',
                        permissionIds: [
                            PermissionName.edit_role_and_permissions_30332,
                        ],
                    },
                ]

                const response = await makeUpdateRolesMutation(input)
                const rolesUpdated = response.body.data.updateRoles
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(rolesUpdated).to.be.null
                expect(errors).to.exist
            })
        })
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
