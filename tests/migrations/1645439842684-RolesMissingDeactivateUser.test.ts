import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { DataSource, QueryRunner } from 'typeorm'
import { Role } from '../../src/entities/role'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { RolesMissingDeactivateUser1645439842684 } from '../../migrations/1645439842684-RolesMissingDeactivateUser'

chai.should()
use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('RolesMissingDeactivateUser1645439842684 migration', () => {
    let baseDataSource: DataSource
    let migrationsDataSource: DataSource
    let runner: QueryRunner

    before(async () => {
        baseDataSource = await createTestConnection()
        // every test has to use the same runner
        // otherwise `is benign if run twice` will
        // cause `baseConnection?.close()` to hang in `after`
        // todo: find out why
        runner = baseDataSource.createQueryRunner()
    })
    after(async () => {
        await baseDataSource?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseDataSource.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsDataSource?.close()
    })

    beforeEach(async () => {
        migrationsDataSource = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        await migrationsDataSource.runMigrations()
        await RoleInitializer.run()
    })

    const getPermissionNamesForRole = async (role: Role) => {
        return (await role?.permissions)?.map((p) => p.permission_name)
    }

    const runMigration = async () => {
        const migration = migrationsDataSource.migrations.find(
            (m) => m.name === RolesMissingDeactivateUser1645439842684.name
        )
        // promise will be rejected if migration fails
        return migration!.up(runner)
    }

    it(`adds deactivate_user_40883 to roles with only edit_this_organization_10330`, async () => {
        const role = await createRole(undefined, undefined, {
            permissions: [PermissionName.edit_this_organization_10330],
        }).save()
        await runMigration()
        const migratedRole = await Role.findOneByOrFail({
            role_id: role.role_id,
        })
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
        const migratedRole = await Role.findOneByOrFail({
            role_id: role.role_id,
        })
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
        const migratedRole = await Role.findOneByOrFail({
            role_id: role.role_id,
        })
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
        const migratedRole = await Role.findOneByOrFail({
            role_id: role.role_id,
        })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder(await getPermissionNamesForRole(role))
    })

    it('is benign if run twice', async () => {
        await expect(runMigration()).to.be.eventually.fulfilled
        await expect(runMigration()).to.be.eventually.fulfilled
    })
})
