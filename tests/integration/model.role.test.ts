import { expect } from 'chai'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Role } from '../../src/entities/role'
import { createRole } from '../utils/operations/organizationOps'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { accountUUID } from '../../src/entities/user'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { getNonAdminAuthToken } from '../utils/testConfig'

const GET_ROLES = `
    query getRoles {
        roles {
            role_id
            role_name
        }
    }
`

const GET_ROLE = `
    query myQuery($role_id: ID!) {
        role(role_id: $role_id) {
            role_id
            role_name
        }
    }
`

describe('model.role', () => {
    let connection: Connection
    let originalAdmins: string[]
    let testClient: ApolloServerTestClient
    let roleInfo = (role: Role) => {
        return role.role_id
    }

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('getRoles', () => {
        context('when none', () => {
            it('returns only the system roles', async () => {
                await createNonAdminUser(testClient)
                let arbitraryUserToken = getNonAdminAuthToken()

                const { query } = testClient

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const systemRoles = await Role.find({
                    where: { system_role: true },
                })

                const roles = res.data?.roles as Role[]
                expect(roles.map(roleInfo)).to.deep.eq(
                    systemRoles.map(roleInfo)
                )
            })
        })

        context('when one', () => {
            let arbitraryUserToken: string

            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
                await createRole(testClient, organization.organization_id)
                await createNonAdminUser(testClient)
                arbitraryUserToken = getNonAdminAuthToken()
            })

            it('should return an array containing the default roles', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: arbitraryUserToken },
                })

                const dbRoles = await Role.find()

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const roles = res.data?.roles as Role[]
                expect(roles).to.exist
                expect(roles).to.have.lengthOf(dbRoles.length)
            })
        })
    })

    describe('getRole', () => {
        context('when none', () => {
            it('should return null', async () => {
                const { query } = testClient

                await createNonAdminUser(testClient)
                let arbitraryUserToken = getNonAdminAuthToken()

                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: accountUUID() },
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                expect(res.data?.role).to.be.null
            })
        })

        context('when one', () => {
            let role: Role
            let arbitraryUserToken: string

            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
                role = await createRole(
                    testClient,
                    organization.organization_id
                )

                await createNonAdminUser(testClient)
                arbitraryUserToken = getNonAdminAuthToken()
            })

            it('should return an array containing the default roles', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: role.role_id },
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const gqlRole = res.data?.role as Role
                expect(gqlRole).to.exist
                expect(role).to.include(gqlRole)
            })
        })
    })
})
