import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Status } from '../../src/entities/status'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createUser } from '../factories/user.factory'
import { runPreviousMigrations } from '../utils/migrations'
import { createTestConnection } from '../utils/testConnection'

chai.should()
use(chaiAsPromised)

describe('OrganizationMembershipDeletionStatus1645033794324 migration', () => {
    let migrationsConnection: Connection

    afterEach(async () => {
        await migrationsConnection?.close()
    })

    beforeEach(async () => {
        migrationsConnection = await createTestConnection({ drop: true })
    })

    context('when all migrations have run', () => {
        beforeEach(async () => {
            // It is preferable to use "each" here, as in prod migrations may not be run in the same transaction.
            // Only migrations which have not been run before will be in the same transaction.
            // 'each' is therefore closer to the behaviour of existing environments.
            await migrationsConnection.runMigrations({ transaction: 'each' })
        })

        afterEach(async () => {
            const pendingMigrations = await migrationsConnection.showMigrations()
            expect(pendingMigrations).to.eq(false)
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
                const runner = migrationsConnection.createQueryRunner()
                await runner.startTransaction()
                const currentMigration = migrationsConnection.migrations.find(
                    (m) =>
                        m.name ===
                        'OrganizationMembershipDeletionStatus1645033794324'
                )!
                await currentMigration.up(runner)
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
    })

    it('is benign if run twice', async () => {
        const runner = migrationsConnection.createQueryRunner()
        const currentMigration = await runPreviousMigrations(
            migrationsConnection,
            runner,
            'OrganizationMembershipDeletionStatus1645033794324'
        )
        await runner.startTransaction()
        await currentMigration!.up(runner).should.be.fulfilled
        await runner.commitTransaction()
        await runner.startTransaction()
        await currentMigration!.up(runner).should.be.fulfilled
        await runner.commitTransaction()
    })
})
