import { Connection } from 'typeorm'
import { MigrationLock1627128803380 } from '../../migrations/1627128803380-MigrationLock'
import logger from '../logging'

export async function runMigrations(connection: Connection) {
    // first check if there are any pending migrations
    const havePendingMigrations = await connection.showMigrations()

    if (!havePendingMigrations) {
        // nothing to do here!
        logger.info('No pending database migrations.')
        return
    } else {
        logger.info(
            'Found pending database migrations, obtaining migration lock...'
        )

        // Always run the MigrationLock to prevent other instances from running migrations
        await connection.query(
            `DELETE FROM migrations where name = '${MigrationLock1627128803380.name}'`
        )

        await connection.runMigrations({
            transaction: 'all', // Run all migrations in a single transaction
        })
    }
}
