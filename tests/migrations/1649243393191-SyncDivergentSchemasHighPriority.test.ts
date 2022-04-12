import chai, { expect, use } from 'chai'
import { Connection, QueryRunner } from 'typeorm'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import chaiAsPromised from 'chai-as-promised'
import { runPreviousMigrations } from '../utils/migrations'

chai.should()
use(chaiAsPromised)

describe('SyncDivergentSchemasHighPriority1649243393191 migration', () => {
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

    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
    })

    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })

    context('when database is populated', () => {
        beforeEach(async () => {
            await migrationsConnection.runMigrations({ transaction: 'each' })
            await RoleInitializer.run()
        })

        const runMigration = async () => {
            const migration = migrationsConnection.migrations.find(
                (m) =>
                    m.name === 'SyncDivergentSchemasHighPriority1649243393191'
            )
            // promise will be rejected if migration fails
            return migration!.up(runner)
        }

        function paramHelper(length: number) {
            const array: string[] = Array(length)
            for (let i = 1; i <= length; i++) {
                array[i - 1] = '$' + i
            }
            return array.join(', ')
        }

        async function getDbConstraints(
            qr: QueryRunner,
            conNames: string[]
        ): Promise<string[]> {
            const constraints = (await qr.query(
                `
                SELECT conname FROM pg_catalog.pg_constraint 
                WHERE conname IN(${paramHelper(conNames.length)});
                `,
                conNames
            )) as { conname: string }[]
            return constraints.map((c) => c.conname)
        }

        context('when there are surplus constraints', () => {
            const orgIdUQOnUser = 'UQ_2af3e757ddd2c6ae0598b094b0b'
            const nameOrgUQOnSchool = 'UQ_d8c1edf6c7d4bf82e0dd8b2f35e'

            beforeEach(async () => {
                await runner.query(
                    `
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${orgIdUQOnUser}') THEN
                            ALTER TABLE ONLY public."user" 
                            ADD CONSTRAINT "${orgIdUQOnUser}" 
                            UNIQUE ("myOrganizationOrganizationId");
                        END IF;
                    END$$;
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${nameOrgUQOnSchool}') THEN
                            ALTER TABLE ONLY public."school" 
                            ADD CONSTRAINT "${nameOrgUQOnSchool}" 
                            UNIQUE (school_name, "organizationOrganizationId");
                        END IF;
                    END$$;
                    `
                )
            })

            it('removes surplus constraints after running migration', async () => {
                const oldConstraints = await getDbConstraints(runner, [
                    orgIdUQOnUser,
                    nameOrgUQOnSchool,
                ])
                expect(oldConstraints).to.have.length(2)
                await runMigration()
                const newConstraints = await getDbConstraints(runner, [
                    orgIdUQOnUser,
                    nameOrgUQOnSchool,
                ])
                expect(newConstraints).to.be.empty
            })
        })

        context('when there are missing constraints', () => {
            const orgIdUQOnUser = 'REL_2af3e757ddd2c6ae0598b094b0'
            const orgIdFKOnBranding = 'FK_76c80b06b6946bc95459a01918c'

            beforeEach(async () => {
                await runner.query(
                    `
                    ALTER TABLE ONLY public."user" DROP CONSTRAINT IF EXISTS "${orgIdUQOnUser}" CASCADE;
                    ALTER TABLE ONLY public."branding" DROP CONSTRAINT IF EXISTS "${orgIdFKOnBranding}" CASCADE;
                    `
                )
            })

            it('adds missing constraints after running migration', async () => {
                const oldConstraints = await getDbConstraints(runner, [
                    orgIdUQOnUser,
                    orgIdFKOnBranding,
                ])
                expect(oldConstraints).to.be.empty
                await runMigration()
                const newConstraints = await getDbConstraints(runner, [
                    orgIdUQOnUser,
                    orgIdFKOnBranding,
                ])
                expect(newConstraints).to.have.length(2)
            })
        })
    })

    it('is benign if run twice', async () => {
        const currentMigration = await runPreviousMigrations(
            migrationsConnection,
            runner,
            'SyncDivergentSchemasHighPriority1649243393191'
        )
        await currentMigration!.up(runner).should.be.fulfilled
        await currentMigration!.up(runner).should.be.fulfilled
    })
})
