import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { OrganizationMembershipDeletionStatus1645033794324 } from '../../migrations/1645033794324-OrganizationMembershipDeletionStatus'
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
        await migrationsConnection.runMigrations()
    })

    for (const status of [Status.ACTIVE, Status.INACTIVE, Status.DELETED]) {
        it(`allows you to save entities with status ${status}`, async () => {
            const org = await createOrganization().save()
            const user = await createUser().save()
            const orgMembership = createOrganizationMembership({
                user,
                organization: org,
            })
            orgMembership.status = status
            await expect(orgMembership.save()).to.not.be.rejected
        })
    }

    it('is benign if run twice', async () => {
        const migration = migrationsConnection.migrations.find(
            (m) =>
                m.name ===
                OrganizationMembershipDeletionStatus1645033794324.name
        )
        const runner = baseConnection.createQueryRunner()
        // promise will be rejected if migration fails
        return migration!.up(runner).should.be.fulfilled
    })
})
