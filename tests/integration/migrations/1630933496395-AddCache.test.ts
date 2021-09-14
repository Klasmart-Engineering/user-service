import { Connection, QueryRunner } from 'typeorm'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../../utils/testConnection'
import { expect } from 'chai'
import { getDatabaseTables } from '../../utils/migrations'
import { AddCache1630933496395 } from '../../../migrations/1630933496395-AddCache'

describe('AddCache1630933496395 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let queryRunner: QueryRunner
    before(async () => {
        baseConnection = await createTestConnection()
        queryRunner = baseConnection.createQueryRunner()
    })
    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        await migrationsConnection.runMigrations()
    })
    after(async () => {
        await baseConnection?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })
    it('creates the cache table', async () => {
        const tables = await getDatabaseTables(migrationsConnection)
        expect(tables).to.include('query-result-cache')
    })

    it('is benign if run twice', async () => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === AddCache1630933496395.name
        )
        await migration!.up(queryRunner)
        const tables = await getDatabaseTables(migrationsConnection)
        expect(tables).to.include('query-result-cache')
    })
})
