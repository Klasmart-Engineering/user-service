import { expect, use } from 'chai'
import { Connection, getRepository, QueryRunner } from 'typeorm'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import { createUser } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { User } from '../../src/entities/user'
import chaiAsPromised from 'chai-as-promised'
import { generateShortCode } from '../../src/utils/shortcode'
import { AddStatusUpdatedAtColumn1645635790974 } from '../../migrations/1645635790974-AddStatusUpdatedAtColumn'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { School } from '../../src/entities/school'
import { createSchool } from '../factories/school.factory'

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
            (m) => m.name === AddStatusUpdatedAtColumn1645635790974.name
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
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })

    context('migration is run once', () => {
        beforeEach(async () => {
            user = await createUser().save()
            organization = await createOrganization().save()
            school = await createSchool(organization).save()
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

            migrationsConnection = await createMigrationsTestConnection(
                false,
                false,
                'migrations'
            )
            await runMigration()

            const updatedOrgMemb = await OrganizationMembership.findOne({
                status_updated_at: deletedAtDate.toISOString(),
            })
            const updatedSchoolMemb = await SchoolMembership.findOne({
                status_updated_at: deletedAtDate.toISOString(),
            })

            expect(updatedOrgMemb).to.exist
            expect(updatedSchoolMemb).to.exist
        })
    })

    context('migration is run twice', () => {
        it('is benign', async () => {
            migrationsConnection = await createMigrationsTestConnection(
                false,
                false,
                'migrations'
            )
            await runMigration()
            await expect(runMigration()).to.be.fulfilled
        })
    })
})
