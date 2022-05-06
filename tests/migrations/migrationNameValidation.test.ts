import { expect } from 'chai'
import fs from 'fs'
import { Connection, MigrationInterface } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'

describe('migration name validation', () => {
    let baseConnection: Connection

    beforeEach(async () => {
        baseConnection = await createTestConnection()
    })

    afterEach(async () => {
        await baseConnection?.close()
    })

    context(
        'database is populated and migrations are ready to be performed',
        () => {
            let migrationList: MigrationInterface[]
            const migrationFilenameList: string[] = []

            beforeEach(async () => {
                migrationList = baseConnection.migrations

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
