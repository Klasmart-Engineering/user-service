import { getConnection } from 'typeorm'
import { expect } from 'chai'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { createOrganizationAndValidate } from '../../utils/operations/userOps'
import { TestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser } from '../../utils/testEntities'
import { Model } from '../../../src/model'
import { Organization } from '../../../src/entities/organization'
import RoleInitializer from '../../../src/initializers/roles'
import { Role } from '../../../src/entities/role'
import { Permission } from '../../../src/entities/permission'
import { permissionInfo } from '../../../src/permissions/permissionInfo'
import { createRole } from '../../factories/role.factory'
import { createPermission } from '../../factories/permission.factory'
import { PermissionName } from '../../../src/permissions/permissionNames'

describe('RolesInitializer', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    it('adds all permissions from permissionInfo.csv', async () => {
        await RoleInitializer.run()

        const filePermissions = await permissionInfo()
        const dbPermissions = await Permission.find()

        expect(dbPermissions.length).to.equal(filePermissions.size)
        expect(
            dbPermissions.map((p) => p.permission_name)
        ).to.have.same.members(Array.from(filePermissions.keys()))
    })

    describe('run', () => {
        const roleInfoFunc = function (role: any) {
            return { role_id: role.role_id, role_name: role.role_name }
        }
        const permissionInfoFunc = function (permission: any) {
            return { permission_name: permission.permission_name }
        }

        context('when updated default permissions exists', () => {
            let organization: Organization

            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
            })

            it('does not modify the default roles permissions', async () => {
                const { mutate } = testClient
                const dbRoles = await organization.roles()
                const dbPermissions = []
                expect(dbRoles).not.to.be.empty

                for (const role of dbRoles) {
                    const permissions = (await role.permissions) || []

                    expect(permissions).not.to.be.empty
                    dbPermissions.push(...permissions.map(permissionInfoFunc))
                }

                await RoleInitializer.run()

                organization = await Organization.findOneByOrFail({
                    organization_id: organization.organization_id,
                })
                const dbNewRoles = await organization.roles()
                expect(dbNewRoles).not.to.be.empty

                expect(dbRoles.map(roleInfoFunc)).to.deep.equalInAnyOrder(
                    dbNewRoles?.map(roleInfoFunc)
                )
                const resetPermissions = []

                for (const role of dbNewRoles) {
                    const permissions = (await role.permissions) || []

                    expect(permissions).not.to.be.empty
                    resetPermissions.push(
                        ...permissions!.map(permissionInfoFunc)
                    )
                }

                expect(dbPermissions).to.deep.members(resetPermissions)
            })
        })

        context('when system roles already exist', () => {
            beforeEach(async () => {
                await RoleInitializer.run()
            })

            it('should not create them again', async () => {
                const rolesBefore = await Role.find()

                // Second initialization, new roles would't be created
                await RoleInitializer.run()
                const rolesAfter = await Role.find()

                expect(rolesAfter).to.have.lengthOf(rolesBefore.length)
                expect(rolesAfter).to.deep.equalInAnyOrder(rolesBefore)
            })
        })

        context(
            'when an existing permission is not in the permissionInfo.csv file but is in an existing custom role',
            () => {
                let organization: Organization
                let role: Role
                let permission: Permission
                const roleName = 'customRole'

                beforeEach(async () => {
                    const user = await createAdminUser(testClient)
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    permission = await createPermission().save()

                    role = createRole(
                        roleName,
                        organization,
                        {
                            permissions: [PermissionName.edit_school_20330],
                        },
                        false
                    )

                    let perms = (await role.permissions) || []
                    perms.push(permission)
                    role.permissions = Promise.resolve(perms)
                    await role.save()
                    perms = await role.permissions
                    expect(perms?.length).to.equal(2)
                })
                context('and the RoleInitializer is run', () => {
                    beforeEach(async () => {
                        await RoleInitializer.run()
                    })
                    it('the permission has been set to allow = false and is removed from a custom role', async () => {
                        const dbperm = await Permission.findOneBy({
                            permission_id: permission?.permission_id,
                        })
                        expect(dbperm).to.exist
                        expect(dbperm?.allow).to.equal(false)
                        const dbRole = await Role.findOneBy({
                            role_id: role.role_id,
                        })
                        const perms = await dbRole?.permissions
                        expect(perms?.length).to.equal(1)
                        const perm = perms![0]
                        expect(perm.permission_name).to.equal(
                            PermissionName.edit_school_20330
                        )
                    })
                })
            }
        )
        context(
            'when an existing permission is not in the permissionInfo.csv file but is in an existing system role',
            () => {
                let organization: Organization
                let role: Role | null
                let permission: Permission
                const roleName = 'Teacher'
                let permsLength = 0

                beforeEach(async () => {
                    const user = await createAdminUser(testClient)
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    permission = await createPermission().save()

                    role = await Role.findOneBy({
                        role_name: roleName,
                        system_role: true,
                    })
                    expect(role).to.exist
                    if (role) {
                        let perms = (await role.permissions) || []
                        permsLength = perms.length
                        perms.push(permission)
                        role.permissions = Promise.resolve(perms)
                        await role.save()
                        perms = await role.permissions
                        expect(perms?.length).to.equal(permsLength + 1)
                    }
                })
                context('and the RoleInitializer is run', () => {
                    beforeEach(async () => {
                        await RoleInitializer.run()
                    })
                    it('the permission has been set to allow = false and is removed from a system role', async () => {
                        const dbperm = await Permission.findOneBy({
                            permission_id: permission?.permission_id,
                        })
                        expect(dbperm).to.exist
                        expect(dbperm?.allow).to.equal(false)
                        const dbRole = await Role.findOneBy({
                            role_id: role?.role_id,
                        })
                        const perms = await dbRole?.permissions
                        expect(perms?.length).to.equal(permsLength)
                        expect(
                            perms!.map((p) => p.permission_id)
                        ).to.not.include(permission.permission_id)
                    })
                })
            }
        )
    })
})
