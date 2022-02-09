import { Connection } from 'typeorm'
import { expect, use } from 'chai'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { createOrganizationAndValidate } from '../../utils/operations/userOps'
import { createTestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser } from '../../utils/testEntities'
import { Model } from '../../../src/model'
import { Organization } from '../../../src/entities/organization'
import RoleInitializer from '../../../src/initializers/roles'
import { Role } from '../../../src/entities/role'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { organizationAdminRole } from '../../../src/permissions/organizationAdmin'
import { schoolAdminRole } from '../../../src/permissions/schoolAdmin'
import { parentRole } from '../../../src/permissions/parent'
import { studentRole } from '../../../src/permissions/student'
import { teacherRole } from '../../../src/permissions/teacher'
import { createRole } from '../../factories/role.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createSchool } from '../../factories/school.factory'
import { User } from '../../../src/entities/user'
import { createUser } from '../../factories/user.factory'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { Status } from '../../../src/entities/status'

use(deepEqualInAnyOrder)

describe('RolesInitializer', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
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

                organization = await Organization.findOneOrFail(
                    organization.organization_id
                )
                const dbNewRoles = await organization.roles()
                expect(dbNewRoles).not.to.be.empty

                expect(dbRoles.map(roleInfoFunc)).to.deep.equal(
                    dbNewRoles?.map(roleInfoFunc)
                )
                const resetPermissions = []

                for (const role of dbNewRoles) {
                    const permissions = (await role.permissions) || []

                    expect(permissions).not.to.be.empty
                    resetPermissions.push(
                        ...permissions?.map(permissionInfoFunc)
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

        context('when already exist duplicated system roles', () => {
            let originalSystemRoles: Role[]
            let duplicatedSystemRoles: Role[]

            beforeEach(async () => {
                originalSystemRoles = Array.from(await RoleInitializer.run())
                const systemRolesData = [
                    organizationAdminRole,
                    schoolAdminRole,
                    parentRole,
                    studentRole,
                    teacherRole,
                ]

                duplicatedSystemRoles = await Role.save(
                    Array.from([...systemRolesData, ...systemRolesData], (d) =>
                        createRole(
                            d.role_name,
                            undefined,
                            { permissions: d.permissions },
                            true
                        )
                    )
                )

                const organization = await createOrganization().save()
                const school = await createSchool().save()
                const users = await User.save(
                    Array.from(originalSystemRoles, () => createUser())
                )

                await OrganizationMembership.save(
                    Array.from(users, (user, i) =>
                        createOrganizationMembership({
                            user,
                            organization,
                            roles: [duplicatedSystemRoles[i]],
                        })
                    )
                )

                await SchoolMembership.save(
                    Array.from(users, (user, i) =>
                        createSchoolMembership({
                            user,
                            school,
                            roles: [
                                duplicatedSystemRoles[
                                    originalSystemRoles.length + i
                                ],
                            ],
                        })
                    )
                )
            })

            it('should remove all the duplications', async () => {
                await RoleInitializer.run()
                const removedRoles = await Role.findByIds(
                    duplicatedSystemRoles.map((r) => r.role_id)
                )

                expect(removedRoles).to.have.lengthOf(
                    duplicatedSystemRoles.length
                )

                removedRoles.forEach((r) => {
                    expect(r.status).to.equal(Status.INACTIVE)
                    expect(r.deleted_at).to.not.be.null
                })
            })

            it('should left just one system role per name', async () => {
                await RoleInitializer.run()
                const persistentRoles = await Role.find({
                    where: { status: Status.ACTIVE },
                })

                expect(persistentRoles).to.have.lengthOf(
                    originalSystemRoles.length
                )

                const persistentNames = persistentRoles.map((r) => r.role_name)
                const uniqueNames = new Set(persistentNames)

                expect(persistentRoles).to.have.lengthOf(uniqueNames.size)
                expect(persistentNames).to.be.deep.equalInAnyOrder(
                    Array.from(uniqueNames.values())
                )
            })

            it('should change the deleted roles to the persistent ones in the organization memberships that are using them', async () => {
                await RoleInitializer.run()

                const orgMemberships = await OrganizationMembership.find()
                expect(orgMemberships).to.have.lengthOf(
                    originalSystemRoles.length
                )

                const originalRoleIds = originalSystemRoles.map(
                    (r) => r.role_id
                )

                const duplicateRoleIds = duplicatedSystemRoles.map(
                    (r) => r.role_id
                )

                for (const m of orgMemberships) {
                    const roles = await m.roles!

                    roles.forEach((r) => {
                        expect(originalRoleIds).to.include(r.role_id)
                        expect(duplicateRoleIds).to.not.include(r.role_id)
                    })
                }
            })

            it('should change the deleted roles to the persistent ones in the school memberships that are using them', async () => {
                await RoleInitializer.run()

                const schoolMemberships = await SchoolMembership.find()
                expect(schoolMemberships).to.have.lengthOf(
                    originalSystemRoles.length
                )

                const originalRoleIds = originalSystemRoles.map(
                    (r) => r.role_id
                )

                const duplicateRoleIds = duplicatedSystemRoles.map(
                    (r) => r.role_id
                )

                for (const m of schoolMemberships) {
                    const roles = await m.roles!

                    roles.forEach((r) => {
                        expect(originalRoleIds).to.include(r.role_id)
                        expect(duplicateRoleIds).to.not.include(r.role_id)
                    })
                }
            })
        })
    })
})
