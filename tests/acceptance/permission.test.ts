import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Permission } from '../../src/entities/permission'
import {
    PERMISSIONS_CONNECTION,
    PERMISSION_NODE,
} from '../utils/operations/modelOps'
import { generateToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { User } from '../../src/entities/user'
import { Organization } from '../../src/entities/organization'
import { createUser } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { permissionSummaryNodeFields } from '../../src/pagination/permissionsConnection'
import { userToPayload } from '../utils/operations/userOps'
import { PermissionConnectionNode } from '../../src/types/graphQL/permission'
import { createRole } from '../factories/role.factory'
import { createPermission } from '../factories/permission.factory'
import { makeRequest } from './utils'

interface IPermissionEdge {
    node: PermissionConnectionNode
}

const url = 'http://localhost:8080'
const request = supertest(url)
let organizationMember: User
let organization: Organization

describe('acceptance.permission', () => {
    let connection: Connection
    let permissionsCount: number

    async function makeConnectionQuery(pageSize: any, token: string) {
        return await request
            .post('/user')
            .set({
                ContentType: 'application/json',
                Authorization: token,
            })
            .send({
                query: print(PERMISSIONS_CONNECTION),
                variables: {
                    direction: 'FORWARD',
                    count: pageSize,
                },
            })
    }

    async function makeNodeQuery(id: string, token: string) {
        return await request
            .post('/user')
            .set({
                ContentType: 'application/json',
                Authorization: token,
            })
            .send({
                query: print(PERMISSION_NODE),
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
        permissionsCount = await Permission.createQueryBuilder('Permission')
            .select(permissionSummaryNodeFields)
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

    context('permissionsConnection', () => {
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
                expect(permissionsConnection.totalCount).to.equal(
                    permissionsCount
                )
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

    context('permissionNode', () => {
        let permissions: IPermissionEdge[]

        beforeEach(async () => {
            const permissionsResponse = await makeConnectionQuery(
                10,
                generateToken(userToPayload(organizationMember))
            )
            permissions =
                permissionsResponse.body.data.permissionsConnection.edges
        })

        context('when requested permission exists', () => {
            it('responds succesfully', async () => {
                const permission = permissions[0].node
                const response = await makeNodeQuery(
                    permission.id,
                    generateToken(userToPayload(organizationMember))
                )
                const permissionNode: PermissionConnectionNode =
                    response.body.data.permissionNode

                expect(response.status).to.eq(200)
                expect(permissionNode.id).to.equal(permission.id)
                expect(permission.name).to.equal(permission.name)
                expect(permission.category).to.equal(permission.category)
                expect(permission.group).to.equal(permission.group)
                expect(permission.level).to.equal(permission.level)
                expect(permission.description).to.equal(permission.description)
                expect(permission.allow).to.equal(permission.allow)
            })
        })

        context('when data is requested in an incorrect way', () => {
            it('should response with errors', async () => {
                const response = await makeNodeQuery(
                    'not-an-existent-name',
                    generateToken(userToPayload(organizationMember))
                )

                const permissionNode = response.body.data.permissionNode
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(permissionNode).to.be.null
                expect(errors).to.exist
            })
        })
    })

    context('permissionsConnection', () => {
        it('has rolesConnection as a child', async () => {
            const query = `
                query permissionsConnection($direction: ConnectionDirection!, $filter: PermissionFilter) {
                    permissionsConnection(direction:$direction, filter: $filter){
                        edges {
                            node {
                                rolesConnection{
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

            const role = await createRole('role1', organization).save()
            const permission = await createPermission(role).save()

            const token = generateToken({
                id: organizationMember.user_id,
                email: organizationMember.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                    filter: {
                        name: {
                            operator: 'eq',
                            value: permission.permission_name,
                        },
                    },
                },
                token
            )

            expect(response.status).to.eq(200)
            expect(
                response.body.data.permissionsConnection.edges[0].node
                    .rolesConnection.edges[0].node.id
            ).to.eq(role.role_id)
        })
    })
})
