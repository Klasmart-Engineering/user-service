import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, QueryRunner } from 'typeorm'
import { Role } from '../../src/entities/role'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { RolesMissingDeactivateUserSchools1645517302183 } from '../../migrations/1645517302183-RolesMissingDeactivateUserSchools'

chai.should()
use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('RolesMissingDeactivateUserSchools1645517302183 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let runner: QueryRunner

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
        await migrationsConnection.runMigrations()
        await RoleInitializer.run()
    })

    const getPermissionNamesForRole = async (role: Role) => {
        return (await role?.permissions)?.map((p) => p.permission_name)
    }

    const runMigration = async () => {
        const migration = migrationsConnection.migrations.find(
            (m) =>
                m.name === RolesMissingDeactivateUserSchools1645517302183.name
        )
        // promise will be rejected if migration fails
        return migration!.up(runner)
    }

    it(`adds deactivate_my_school_user_40885 to roles with only edit_school_20330`, async () => {
        const role = await createRole(undefined, undefined, {
            permissions: [PermissionName.edit_school_20330],
        }).save()
        await runMigration()
        const migratedRole = await Role.findOneByOrFail({
            role_id: role.role_id,
        })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder([
            PermissionName.edit_school_20330,
            PermissionName.deactivate_my_school_user_40885,
        ])
    })

    it(`does not effect system roles`, async () => {
        const role = await createRole(
            undefined,
            undefined,
            {
                permissions: [PermissionName.edit_school_20330],
            },
            true
        ).save()
        await runMigration()
        const migratedRole = await Role.findOneByOrFail({
            role_id: role.role_id,
        })
        expect(
            await getPermissionNamesForRole(migratedRole)
        ).deep.equalInAnyOrder([PermissionName.edit_school_20330])
    })

    it(`does not effect roles with both permissions already`, async () => {
        const role = await createRole(undefined, undefined, {
            permissions: [
                PermissionName.edit_school_20330,
                PermissionName.deactivate_my_school_user_40885,
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
                PermissionName.edit_school_20330,
                PermissionName.deactivate_my_school_user_40885,
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
