import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, MigrationInterface } from 'typeorm'
import { OrganizationMembershipDeletionStatus1645033794324 } from '../../migrations/1645033794324-OrganizationMembershipDeletionStatus'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Status } from '../../src/entities/status'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createUser } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

chai.should()
use(chaiAsPromised)

describe('OrganizationMembershipDeletionStatus1645033794324 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let migrationToTest: MigrationInterface

    before(async () => {
        baseConnection = await createTestConnection()
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

        migrationToTest = migrationsConnection.migrations.find(
            (m) =>
                m.name ===
                OrganizationMembershipDeletionStatus1645033794324.name
        )!

        // it is very important to use "each" here
        // as in prod this migration will not be run in the same transaction
        // as previous migrations that have already run
        // specifcly the initial state migration that creates organization_membership_status_enum
        await migrationsConnection.runMigrations({ transaction: 'each' })
    })

    for (const status of [Status.ACTIVE, Status.INACTIVE]) {
        it(`preserves rows with a status of ${status}`, async () => {
            const org = await createOrganization().save()
            const user = await createUser().save()
            const orgMembership = await createOrganizationMembership({
                user,
                organization: org,
                status: status,
            }).save()
            const runner = baseConnection.createQueryRunner()
            await runner.startTransaction()
            await migrationToTest.up(runner)
            await runner.commitTransaction()
            await runner.release()
            const postMigrationOrgMembership = await OrganizationMembership.findOneOrFail(
                {
                    where: {
                        user_id: orgMembership.user_id,
                        organization_id: orgMembership.organization_id,
                    },
                }
            )
            expect(postMigrationOrgMembership.status).to.eq(status)
        })
    }

    for (const status of [Status.ACTIVE, Status.INACTIVE, Status.DELETED]) {
        it(`allows you to save organization memberships with status ${status}`, async () => {
            const org = await createOrganization().save()
            const user = await createUser().save()
            const orgMembership = createOrganizationMembership({
                user,
                organization: org,
                status: status,
            })
            await expect(orgMembership.save()).to.not.be.rejected
        })
    }

    it('is benign if run twice', async () => {
        const runner = baseConnection.createQueryRunner()
        // we need a transaction as this migration uses a lock
        // which is only valid in transaction blocks
        await runner.startTransaction()
        // promise will be rejected if migration fails
        await migrationToTest!.up(runner).should.be.fulfilled
        await runner.rollbackTransaction()
    })
})
