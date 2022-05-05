import { expect } from 'chai'
import fs from 'fs'
import { Connection, MigrationInterface, QueryRunner } from 'typeorm'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

describe('migration name validation', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let runner: QueryRunner

    before(async () => {
        baseConnection = await createTestConnection()
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

    context(
        'database is populated and migrations are ready to be performed',
        () => {
            let migrationList: MigrationInterface[]
            const migrationFilenameList: string[] = []

            beforeEach(async () => {
                migrationList = migrationsConnection.migrations

                for (const file of fs.readdirSync('./migrations/')) {
                    if (
                        file != '.gitkeep' &&
                        !migrationFilenameList.includes(file)
                    ) {
                        migrationFilenameList.push(file)
                    }
                }
            })

            it('migration name property matches its class name', () => {
                for (const migration of migrationList) {
                    expect(migration.constructor.name).to.eq(migration.name)
                }
            })

            it('migration name property contains matching timestamp (and migration description) with corresponding filename', () => {
                for (const migration of migrationList) {
                    const timestamp = migration
                        .name!.split('')
                        .filter((char) => /[0-9]/.test(char))
                        .join('')
                    const migrationDescriptor = migration
                        .name!.split('')
                        .filter((char) => /[a-zA-Z]/.test(char))
                        .join('')
                    expect(migrationFilenameList).to.contain(
                        `${timestamp}-${migrationDescriptor}.ts`
                    )
                }
            })
        }
    )
})
