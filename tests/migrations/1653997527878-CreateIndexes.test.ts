import chai, { expect, use } from 'chai'
import { Connection, QueryRunner } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'
import chaiAsPromised from 'chai-as-promised'
import { runPreviousMigrations } from '../utils/migrations'
import {
    CreateIndexes1653997527878,
    orgMemOrgIdIndex,
    schoolMemOrgIdIndex,
    subcatOrgIdIndex,
} from '../../migrations/1653997527878-CreateIndexes'

chai.should()
use(chaiAsPromised)

describe('CreateIndexes1653997527878 migration', () => {
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
        await baseConnection?.destroy()
    })

    const runMigration = async () => {
        const migration = baseConnection.migrations.find(
            (m) => m.name === 'CreateIndexes1653997527878'
        )
        // promise will be rejected if migration fails
        return migration!.up(runner)
    }
    context('up', () => {
        beforeEach(async () => {
            await runPreviousMigrations(
                baseConnection,
                runner,
                'CreateIndexes1653997527878'
            )
        })

        it(`it creates the ${orgMemOrgIdIndex} index`, async () => {
            await runMigration()
            const result = await runner.query(
                `SELECT 'dummy' FROM pg_indexes WHERE indexname = '${orgMemOrgIdIndex}';`
            )
            expect(result).to.have.length(1)
        })

        it(`it creates the ${schoolMemOrgIdIndex} index`, async () => {
            await runMigration()
            const result = await runner.query(
                `SELECT 'dummy' FROM pg_indexes WHERE indexname = '${schoolMemOrgIdIndex}';`
            )
            expect(result).to.have.length(1)
        })

        it(`it creates the ${subcatOrgIdIndex} index`, async () => {
            await runMigration()
            const result = await runner.query(
                `SELECT 'dummy' FROM pg_indexes WHERE indexname = '${subcatOrgIdIndex}';`
            )
            expect(result).to.have.length(1)
        })
    })

    context('down', () => {
        beforeEach(async () => {
            await runPreviousMigrations(
                baseConnection,
                runner,
                'CreateIndexes1653997527878'
            )
            await runMigration()
        })

        it(`down drops the ${orgMemOrgIdIndex} index`, async () => {
            await new CreateIndexes1653997527878().down(runner)
            const result = await runner.query(
                `SELECT 'dummy' FROM pg_indexes WHERE indexname = '${orgMemOrgIdIndex}';`
            )
            expect(result).to.have.length(0)
        })

        it(`down drops the ${schoolMemOrgIdIndex} index`, async () => {
            await new CreateIndexes1653997527878().down(runner)
            const result = await runner.query(
                `SELECT 'dummy' FROM pg_indexes WHERE indexname = '${schoolMemOrgIdIndex}';`
            )
            expect(result).to.have.length(0)
        })

        it(`down drops the ${subcatOrgIdIndex} index`, async () => {
            await new CreateIndexes1653997527878().down(runner)
            const result = await runner.query(
                `SELECT 'dummy' FROM pg_indexes WHERE indexname = '${subcatOrgIdIndex}';`
            )
            expect(result).to.have.length(0)
        })
    })
})
