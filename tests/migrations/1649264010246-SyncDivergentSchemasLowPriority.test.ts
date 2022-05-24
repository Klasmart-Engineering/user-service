import chai, { expect, use } from 'chai'
import { Connection, QueryRunner } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import chaiAsPromised from 'chai-as-promised'
import { runPreviousMigrations } from '../utils/migrations'

chai.should()
use(chaiAsPromised)

describe('SyncDivergentSchemasLowPriority1649264010246 migration', () => {
    let baseConnection: Connection
    let runner: QueryRunner

    beforeEach(async () => {
        baseConnection = await createTestConnection({
            drop: true,
        })
        runner = baseConnection.createQueryRunner()
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(true)
    })

    afterEach(async () => {
        await baseConnection?.close()
    })

    context('when database is populated', () => {
        beforeEach(async () => {
            await baseConnection.runMigrations({ transaction: 'each' })
            await RoleInitializer.run()
        })

        afterEach(async () => {
            const pendingMigrations = await baseConnection.showMigrations()
            expect(pendingMigrations).to.eq(false)
        })

        const runMigration = async () => {
            const migration = baseConnection.migrations.find(
                (m) => m.name === 'SyncDivergentSchemasLowPriority1649264010246'
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

        context('when there are surplus tables', () => {
            const surplusTables: string[] = [
                'attendance',
                'subject_subcategories_subcategory',
                'user_metrics_query_count',
                'user_metrics_query_variables',
                'backup_attendance',
                'keep_orgs',
                'rooms',
                'users',
                'assessment_xapi_answer',
                'assessment_xapi_migration',
                'assessment_xapi_room',
                'assessment_xapi_teacher_score',
                'assessment_xapi_teacher_comment',
                'assessment_xapi_user_content_score',
                'backup_assessment_xapi_room',
                'bk_assessment_xapi_answer',
                'bk_assessment_xapi_teacher_comment',
                'bk_assessment_xapi_teacher_score',
                'bk_assessment_xapi_user_content_score',
                'bk_feedback',
                'bk_quick_feedback',
                'feedback',
                'quick_feedback',
                'pdf_metadata',
            ]

            async function getDbTables(
                qr: QueryRunner,
                tableNames: string[]
            ): Promise<string[]> {
                const tables = (await qr.query(
                    `
                    SELECT tablename FROM pg_catalog.pg_tables 
                    WHERE tablename IN(${paramHelper(tableNames.length)});
                    `,
                    tableNames
                )) as { tablename: string }[]
                return tables.map((table) => table.tablename)
            }

            beforeEach(async () => {
                await runner.query(
                    surplusTables
                        .map(
                            (tableName) =>
                                `
                                CREATE TABLE IF NOT EXISTS "${tableName}" 
                                ("placeholder" character varying NOT NULL);
                                `
                        )
                        .join('')
                )
            })

            it('migration removes surplus tables', async () => {
                const oldTables = await getDbTables(runner, surplusTables)
                expect(oldTables).to.be.have.length(surplusTables.length)
                await runMigration()
                const newTables = await getDbTables(runner, surplusTables)
                expect(newTables).to.be.empty
            })
        })

        context('when there are surplus enums', () => {
            const surplusEnums: string[] = [
                'attendance_status_enum',
                'feedback_type_enum',
                'quickfeedback_type_enum',
            ]

            async function getDbEnums(
                qr: QueryRunner,
                enumNames: string[]
            ): Promise<string[]> {
                const enums = (await qr.query(
                    `
                    SELECT typname FROM pg_catalog.pg_type
                    WHERE typname IN (${paramHelper(enumNames.length)});
                    `,
                    enumNames
                )) as { typname: string }[]
                return enums.map((e) => e.typname)
            }

            beforeEach(async () => {
                await runner.query(
                    surplusEnums
                        .map(
                            (enumName) =>
                                `CREATE TYPE "${enumName}" AS ENUM('active', 'inactive');`
                        )
                        .join('')
                )
            })

            it('removes surplus enums after running migration', async () => {
                const oldEnums = await getDbEnums(runner, surplusEnums)
                expect(oldEnums).to.have.length(surplusEnums.length)
                await runMigration()
                const newEnums = await getDbEnums(runner, surplusEnums)
                expect(newEnums).to.be.empty
            })
        })

        context('when there are surplus sequences', () => {
            const surplusSequences: string[] = [
                'assessment_xapi_answer_user_id_seq',
                'assessment_xapi_migration_user_id_seq',
                'assessment_xapi_room_user_id_seq',
                'assessment_xapi_teacher_comment_user_id_seq',
                'assessment_xapi_teacher_score_user_id_seq',
                'assessment_xapi_user_content_score_user_id_seq',
                'quick_feedback_id_seq',
            ]

            async function getDbSequences(
                qr: QueryRunner,
                sequenceNames: string[]
            ): Promise<string[]> {
                const sequences = (await qr.query(
                    `
                    SELECT sequencename FROM pg_catalog.pg_sequences
                    WHERE sequencename IN(${paramHelper(sequenceNames.length)});
                    `,
                    sequenceNames
                )) as { sequencename: string }[]
                return sequences.map((s) => s.sequencename)
            }

            beforeEach(async () => {
                await runner.query(
                    surplusSequences
                        .map(
                            (seqName) =>
                                `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1;`
                        )
                        .join('')
                )
            })

            it('removes surplus sequences after running migration', async () => {
                const oldSequences = await getDbSequences(
                    runner,
                    surplusSequences
                )
                expect(oldSequences).to.have.length(surplusSequences.length)
                await runMigration()
                const newSequences = await getDbSequences(
                    runner,
                    surplusSequences
                )
                expect(newSequences).to.be.empty
            })
        })
    })

    it('is benign if run twice', async () => {
        const currentMigration = await runPreviousMigrations(
            baseConnection,
            runner,
            'SyncDivergentSchemasLowPriority1649264010246'
        )
        await currentMigration!.up(runner).should.be.fulfilled
        await currentMigration!.up(runner).should.be.fulfilled
    })
})
