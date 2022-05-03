import { expect } from 'chai'
import { Connection, QueryRunner, TableColumn } from 'typeorm'
import { DefaultNowInStatusUpdatedAtForMemberships1651530864321 } from '../../migrations/1651530864321-DefaultNowInStatusUpdatedAtForMemberships'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { generateShortCode } from '../../src/utils/shortcode'
import { createOrganization } from '../factories/organization.factory'
import { createSchool } from '../factories/school.factory'
import { createUser } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

describe('DefaultNowInStatusUpdatedAtForMemberships1651270075991 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let runner: QueryRunner
    const omTableName = 'organization_membership'
    const smTableName = 'school_membership'
    const statusUpdatedAtColumnName = 'status_updated_at'

    async function getStatusUpdatedAtColumnInMemberships() {
        const organizationMembershipTable = await runner.getTable(omTableName)
        const omStatusUpdatedAtColumn = organizationMembershipTable!.findColumnByName(
            statusUpdatedAtColumnName
        )

        const schoolMembershipTable = await runner.getTable(smTableName)
        const smStatusUpdatedAtColumn = schoolMembershipTable!.findColumnByName(
            statusUpdatedAtColumnName
        )

        return { omStatusUpdatedAtColumn, smStatusUpdatedAtColumn }
    }

    async function removeDefaultOnStatusUpdatedAtColumns(tableName: string) {
        const table = await runner.getTable(tableName)
        const column = table?.findColumnByName(statusUpdatedAtColumnName)

        if (column) {
            const newColumn = new TableColumn({
                ...column,
                default: undefined,
            })

            await runner.changeColumn(tableName, column, newColumn)
        }
    }

    async function runMigration() {
        const migration = migrationsConnection.migrations.find(
            (m) =>
                m.name ===
                DefaultNowInStatusUpdatedAtForMemberships1651530864321.name
        )

        // promise will be rejected if migration fails
        return migration!.up(runner)
    }

    async function createMemberships() {
        const user = await runner.manager.save(createUser())
        const organization = await runner.manager.save(createOrganization())
        const school = await runner.manager.save(createSchool(organization))

        await runner.query(
            `INSERT INTO "organization_membership" (
                "user_id",
                "organization_id",
                "shortcode",
                "userUserId",
                "organizationOrganizationId"
            ) VALUES (
                '${user.user_id}',
                '${organization.organization_id}',
                '${generateShortCode(user.user_id)}',
                '${user.user_id}',
                '${organization.organization_id}');`
        )

        await runner.query(
            `INSERT INTO "school_membership" (
                "user_id",
                "school_id",
                "userUserId",
                "schoolSchoolId"
            ) VALUES (
                '${user.user_id}',
                '${school.school_id}',
                '${user.user_id}',
                '${school.school_id}');`
        )

        const organizationMembership = await runner.manager.findOne(
            OrganizationMembership,
            {
                where: {
                    user_id: user.user_id,
                    organization_id: organization.organization_id,
                },
            }
        )

        const schoolMembership = await runner.manager.findOne(
            SchoolMembership,
            {
                where: {
                    user_id: user.user_id,
                    school_id: school.school_id,
                },
            }
        )

        return { organizationMembership, schoolMembership }
    }

    before(async () => {
        baseConnection = await createTestConnection()
        runner = baseConnection.createQueryRunner()
    })

    beforeEach(async () => {
        // Make sure status_updated_at column does not have any as default - simulates pre-migration situation
        await removeDefaultOnStatusUpdatedAtColumns('organization_membership')
        await removeDefaultOnStatusUpdatedAtColumns('school_membership')
    })

    after(async () => {
        await baseConnection?.close()
    })

    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()

        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })

    context('when database is populated', () => {
        it('set now() as default for status_updated_at column in organization and school membership tables', async () => {
            const {
                omStatusUpdatedAtColumn,
                smStatusUpdatedAtColumn,
            } = await getStatusUpdatedAtColumnInMemberships()

            // Checking that status_updated_at column has not default value
            expect(omStatusUpdatedAtColumn!.default).to.be.undefined
            expect(smStatusUpdatedAtColumn!.default).to.be.undefined

            const {
                organizationMembership,
                schoolMembership,
            } = await createMemberships()

            // Checking that status_updated_at column has not default value saving memberships
            expect(organizationMembership!.status_updated_at).to.be.null
            expect(schoolMembership!.status_updated_at).to.be.null

            migrationsConnection = await createMigrationsTestConnection(
                false,
                false,
                'migrations'
            )

            await runMigration()
            const updated = await getStatusUpdatedAtColumnInMemberships()

            // Checking that status_updated_at column now has default value
            expect(updated.omStatusUpdatedAtColumn!.default).to.equal('now()')
            expect(updated.smStatusUpdatedAtColumn!.default).to.equal('now()')

            const newMemberships = await createMemberships()

            // Checking that status_updated_at column has default value saving memberships
            expect(
                newMemberships.organizationMembership!.status_updated_at
            ).to.be.an('date')

            expect(newMemberships.schoolMembership!.status_updated_at).to.be.an(
                'date'
            )
        })
    })
})
