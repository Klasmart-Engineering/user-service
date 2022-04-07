import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, MigrationInterface, QueryRunner } from 'typeorm'
import { Role } from '../../src/entities/role'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { runPreviousMigrations } from '../utils/migrations'

chai.should()
use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('RolesMissingDeactivateUser1645439842684 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let runner: QueryRunner
    let currentMigration: MigrationInterface

    before(async () => {
        baseConnection = await createTestConnection()
        // every test has to use the same runner
        // otherwise `is benign if run twice` will
        // cause `baseConnection?.close()` to hang in `after`
        // todo: find out why
        runner = baseConnection.createQueryRunner()
    })
    after(async () => {
        await baseConnection?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })

    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        currentMigration = (await runPreviousMigrations(
            migrationsConnection,
            runner,
            'RolesMissingDeactivateUser1645439842684'
        ))!
        await RoleInitializer.run()
    })

    const getPermissionNamesForRole = async (role: Role) => {
        return (await role?.permissions)?.map((p) => p.permission_name)
    }

    const runMigration = () => currentMigration!.up(runner)

    it(`adds deactivate_user_40883 to roles with only edit_this_organization_10330`, async () => {
        const role = await createRole(undefined, undefined, {
            permissions: [PermissionName.edit_this_organization_10330],
        }).save()
        await runMigration()
        const migratedRole = await Role.findOneOrFail({ role_id: role.role_id })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder([
            PermissionName.edit_this_organization_10330,
            PermissionName.deactivate_user_40883,
        ])
    })

    it(`does not effect system roles`, async () => {
        const role = await createRole(
            undefined,
            undefined,
            {
                permissions: [PermissionName.edit_this_organization_10330],
            },
            true
        ).save()
        await runMigration()
        const migratedRole = await Role.findOneOrFail({ role_id: role.role_id })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder([PermissionName.edit_this_organization_10330])
    })

    it(`does not effect roles with both permissions already`, async () => {
        const role = await createRole(undefined, undefined, {
            permissions: [
                PermissionName.edit_this_organization_10330,
                PermissionName.deactivate_user_40883,
            ],
        }).save()
        await runMigration()
        const migratedRole = await Role.findOneOrFail({ role_id: role.role_id })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder(await getPermissionNamesForRole(role))
    })

    it(`does not effect roles with neither permission`, async () => {
        const role = await createRole(undefined, undefined, {
            permissions: [
                PermissionName.edit_this_organization_10330,
                PermissionName.deactivate_user_40883,
            ],
        }).save()
        await runMigration()
        const migratedRole = await Role.findOneOrFail({ role_id: role.role_id })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder(await getPermissionNamesForRole(role))
    })

    it('is benign if run twice', async () => {
        await runMigration().should.be.fulfilled
        await runMigration().should.be.fulfilled
    })
})
