import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { QueryRunner } from 'typeorm'
import {
    DeletingDuplicatedSystemRoles1647009770308,
    rolesToDeleteIds,
} from '../../migrations/1647009770308-DeletingDuplicatedSystemRoles'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Role } from '../../src/entities/role'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { User } from '../../src/entities/user'
import RoleInitializer from '../../src/initializers/roles'
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
import { createTestConnection, TestConnection } from '../utils/testConnection'

use(deepEqualInAnyOrder)

describe('DeletingDuplicatedSystemRoles', () => {
    let migrationsConnection: TestConnection
    let originalSystemRoles: Role[]
    let duplicatedSystemRoles: Role[]
    let organization: Organization

    const runMigration = async (runner: QueryRunner) => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === DeletingDuplicatedSystemRoles1647009770308.name
        )
        return migration!.up(runner)
    }

    async function createDuplicateRoles() {
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

        organization = await createOrganization().save()
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
    }

    beforeEach(async () => {
        migrationsConnection = await createTestConnection({
            drop: true,
            synchronize: true,
        })
        await createDuplicateRoles()
        const pendingMigrations = await migrationsConnection.showMigrations()
        expect(pendingMigrations).to.eq(true)
        await migrationsConnection.runMigrations()
        await expect(migrationsConnection.showMigrations()).to.eventually.eq(
            false
        )
    })

    afterEach(async () => {
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

    it('executes a fixed number of queries', async () => {
        // 1 for roles to delete
        // 1 for roles to persist
        // 10 (5x2) for updating memberships with both original & dupe role assigned
        // 10 (5x2) for updating each role in each membership table
        // 1 to delete roles
        const numQueries = 23

        await createDuplicateRoles()

        migrationsConnection.logger.reset()
        await runMigration(migrationsConnection.createQueryRunner())
        expect(migrationsConnection.logger.count).to.eq(numQueries)
    })

    context('when a user has both the original and duplicated role', () => {
        let membership: OrganizationMembership
        let originalRole: Role
        beforeEach(async () => {
            await createDuplicateRoles()
            const user = await createUser().save()

            originalRole = originalSystemRoles.find(
                (r) => r.role_name === organizationAdminRole.role_name
            )!
            const dupe = duplicatedSystemRoles.find(
                (r) => r.role_name === organizationAdminRole.role_name
            )

            membership = await createOrganizationMembership({
                user,
                organization,
                roles: [originalRole!, dupe!],
            }).save()
        })
        it('deletes the dupe', async () => {
            await expect(runMigration(migrationsConnection.createQueryRunner()))
                .to.be.fulfilled

            await membership.reload()
            const roles = await membership.roles
            expect(roles).to.have.lengthOf(1)
            expect(roles![0].role_name).eq(organizationAdminRole.role_name)
            expect(roles![0].role_id).eq(originalRole.role_id)
        })
    })
})
