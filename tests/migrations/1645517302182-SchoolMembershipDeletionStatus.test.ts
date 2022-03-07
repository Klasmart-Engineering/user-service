import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, MigrationInterface } from 'typeorm'
import { SchoolMembershipDeletionStatus1645438258990 } from '../../migrations/1645517302182-SchoolMembershipDeletionStatus'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { Status } from '../../src/entities/status'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createUser } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

chai.should()
use(chaiAsPromised)

describe('1645438258990-SchoolMembershipDeletionStatus migration', () => {
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
            (m) => m.name === SchoolMembershipDeletionStatus1645438258990.name
        )!

        await migrationsConnection.runMigrations({ transaction: 'each' })
    })

    for (const status of [Status.ACTIVE, Status.INACTIVE]) {
        it(`preserves rows with a status of ${status}`, async () => {
            const school = await createSchool().save()
            const user = await createUser().save()
            const schoolMembership = await createSchoolMembership({
                user,
                school,
                status,
            }).save()
            const runner = baseConnection.createQueryRunner()
            await runner.startTransaction()
            await migrationToTest.up(runner)
            await runner.commitTransaction()
            await runner.release()
            const postMigrationSchoolMembership = await SchoolMembership.findOneOrFail(
                {
                    where: {
                        user_id: schoolMembership.user_id,
                        school_id: schoolMembership.school_id,
                    },
                }
            )
            expect(postMigrationSchoolMembership.status).to.eq(status)
        })
    }

    for (const status of [Status.ACTIVE, Status.INACTIVE, Status.DELETED]) {
        it(`allows you to save school memberships with status ${status}`, async () => {
            const school = await createSchool().save()
            const user = await createUser().save()
            const schoolMembership = createSchoolMembership({
                user,
                school,
                status,
            })
            await expect(schoolMembership.save()).to.not.be.rejected
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
