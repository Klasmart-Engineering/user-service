import { Connection, MigrationInterface, QueryRunner } from 'typeorm'

export async function runPreviousMigrations(
    migrationsConnection: Connection,
    runner: QueryRunner,
    currentMigrationName: string
): Promise<MigrationInterface | undefined> {
    let myMigration: MigrationInterface | undefined = undefined

    for (const m of migrationsConnection.migrations) {
        if (m.name === currentMigrationName) {
            myMigration = m
            break
        }
        if (m.name === 'MigrationLock1627128803380') continue

        // we need to wait for the previous migration to finish before starting the next one
        // eslint-disable-next-line no-await-in-loop
        await runner.startTransaction()
        // eslint-disable-next-line no-await-in-loop
        await m.up(runner)
        // eslint-disable-next-line no-await-in-loop
        await runner.commitTransaction()
    }

    return myMigration
}
