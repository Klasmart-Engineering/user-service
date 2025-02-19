import chai, { expect, use } from 'chai'
import { Connection, getRepository, QueryRunner } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'
import { createUser } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { User } from '../../src/entities/user'
import chaiAsPromised from 'chai-as-promised'
import { generateShortCode } from '../../src/utils/shortcode'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { School } from '../../src/entities/school'
import { createSchool } from '../factories/school.factory'
import { runPreviousMigrations } from '../utils/migrations'

chai.should()
use(chaiAsPromised)

describe('AddStatusUpdatedAtColumn1645635790974 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let runner: QueryRunner

    let user: User
    let organization: Organization
    let school: School
    const deletedAtDate: Date = new Date()

    const runMigration = async () => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === 'AddStatusUpdatedAtColumn1645635790974'
        )
        // promise will be rejected if migration fails
        return migration!.up(runner)
    }

    before(async () => {
        baseConnection = await createTestConnection()
        runner = baseConnection.createQueryRunner()
    })
    beforeEach(async () => {
        // Make sure status_updated_at column in orgMemb table is dropped first - simulates pre-migration situation
        await runner.query(
            `ALTER TABLE "organization_membership" DROP COLUMN IF EXISTS status_updated_at;`
        )
        await runner.query(
            `ALTER TABLE "school_membership" DROP COLUMN IF EXISTS status_updated_at;`
        )
    })
    after(async () => {
        await baseConnection?.close()
    })
    afterEach(async () => {
        await migrationsConnection?.close()
    })

    context('when database is populated', () => {
        beforeEach(async () => {
            migrationsConnection = await createTestConnection({
                synchronize: false,
                drop: false,
                name: 'migrations',
            })

            user = await createUser().save()
            organization = await createOrganization().save()
            school = await createSchool().save()
        })

        it('adds a status_updated_at column and copies over deleted_at data in the school and organization membership tables', async () => {
            await expect(
                getRepository(OrganizationMembership)
                    .createQueryBuilder()
                    .select('status_updated_at')
                    .getMany()
            ).to.be.rejectedWith('column "status_updated_at" does not exist')
            await expect(
                getRepository(SchoolMembership)
                    .createQueryBuilder()
                    .select('status_updated_at')
                    .getMany()
            ).to.be.rejectedWith('column "status_updated_at" does not exist')

            // Insert pre-migration org membership
            await runner.query(
                `INSERT INTO "organization_membership"("created_at", "updated_at", "deleted_at", "status", "user_id", "organization_id", "join_timestamp", "shortcode", "userUserId", "organizationOrganizationId") VALUES (DEFAULT, DEFAULT, '${deletedAtDate.toISOString()}', DEFAULT, '${
                    user.user_id
                }', '${
                    organization.organization_id
                }', DEFAULT, '${generateShortCode(user.user_id)}', '${
                    user.user_id
                }', '${organization.organization_id}');`
            )
            // Insert pre-migration school membership
            await runner.query(
                `INSERT INTO "school_membership"("created_at", "updated_at", "deleted_at", "status", "user_id", "school_id", "join_timestamp", "userUserId", "schoolSchoolId") VALUES (DEFAULT, DEFAULT, '${deletedAtDate.toISOString()}', DEFAULT, '${
                    user.user_id
                }', '${school.school_id}', DEFAULT, '${user.user_id}', '${
                    school.school_id
                }');`
            )

            await runMigration()

            const updatedOrgMemb = await OrganizationMembership.findOneBy({
                status_updated_at: deletedAtDate,
            })
            const updatedSchoolMemb = await SchoolMembership.findOneBy({
                status_updated_at: deletedAtDate,
            })

            expect(updatedOrgMemb).to.exist
            expect(updatedSchoolMemb).to.exist
        })
    })

    it('is benign if run twice', async () => {
        migrationsConnection = await createTestConnection({
            drop: true,
            synchronize: false,
            name: 'migrations',
        })
        const currentMigration = await runPreviousMigrations(
            migrationsConnection,
            runner,
            'AddStatusUpdatedAtColumn1645635790974'
        )
        await currentMigration!.up(runner).should.be.fulfilled
        await currentMigration!.up(runner).should.be.fulfilled
    })
})
