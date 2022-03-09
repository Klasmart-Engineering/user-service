import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Role } from '../../src/entities/role'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { User } from '../../src/entities/user'
import { organizationAdminRole } from '../../src/permissions/organizationAdmin'
import { parentRole } from '../../src/permissions/parent'
import { schoolAdminRole } from '../../src/permissions/schoolAdmin'
import { studentRole } from '../../src/permissions/student'
import { teacherRole } from '../../src/permissions/teacher'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createUser } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { rolesToDeleteIds } from '../../migrations/1644427897509-DeletingDuplicatedSystemRoles'

use(deepEqualInAnyOrder)

describe('DeletingDuplicatedSystemRoles', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let originalSystemRoles: Role[]
    let duplicatedSystemRoles: Role[]

    before(async () => {
        baseConnection = await createTestConnection()
    })

    after(async () => {
        await baseConnection?.close()
    })

    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            true,
            'migrations'
        )

        const systemRolesData = [
            organizationAdminRole,
            schoolAdminRole,
            parentRole,
            studentRole,
            teacherRole,
        ]

        originalSystemRoles = Array.from(await RoleInitializer.run())
        duplicatedSystemRoles = await Role.save(
            Array.from(systemRolesData, (d, i) => {
                const role = createRole(
                    d.role_name,
                    undefined,
                    { permissions: d.permissions },
                    true
                )

                role.role_id = rolesToDeleteIds[i]
                return role
            })
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
                    roles: [duplicatedSystemRoles[i]],
                })
            )
        )

        await migrationsConnection.runMigrations()
    })

    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })

    it('should hard delete all the duplications', async () => {
        const removedRoles = await Role.findByIds(
            duplicatedSystemRoles.map((r) => r.role_id)
        )

        expect(removedRoles).to.have.lengthOf(0)
    })

    it('should left just one system role per name', async () => {
        const persistentRoles = await Role.find()
        expect(persistentRoles).to.have.lengthOf(originalSystemRoles.length)

        const persistentNames = persistentRoles.map((r) => r.role_name)
        const uniqueNames = new Set(persistentNames)

        expect(persistentRoles).to.have.lengthOf(uniqueNames.size)
        expect(persistentNames).to.be.deep.equalInAnyOrder(
            Array.from(uniqueNames.values())
        )
    })

    it('should change the deleted roles to the persistent ones in the organization memberships that are using them', async () => {
        const orgMemberships = await OrganizationMembership.find()
        expect(orgMemberships).to.have.lengthOf(originalSystemRoles.length)

        const originalRoleIds = originalSystemRoles.map((r) => r.role_id)
        const duplicateRoleIds = duplicatedSystemRoles.map((r) => r.role_id)

        for (const m of orgMemberships) {
            const roles = await m.roles!

            roles.forEach((r) => {
                expect(originalRoleIds).to.include(r.role_id)
                expect(duplicateRoleIds).to.not.include(r.role_id)
            })
        }
    })

    it('should change the deleted roles to the persistent ones in the school memberships that are using them', async () => {
        const schoolMemberships = await SchoolMembership.find()
        expect(schoolMemberships).to.have.lengthOf(originalSystemRoles.length)

        const originalRoleIds = originalSystemRoles.map((r) => r.role_id)
        const duplicateRoleIds = duplicatedSystemRoles.map((r) => r.role_id)

        for (const m of schoolMemberships) {
            const roles = await m.roles!

            roles.forEach((r) => {
                expect(originalRoleIds).to.include(r.role_id)
                expect(duplicateRoleIds).to.not.include(r.role_id)
            })
        }
    })
})
