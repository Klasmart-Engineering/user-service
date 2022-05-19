import {
    DataSource,
    EntityMetadata,
    EntityTarget,
    Table,
    TableForeignKey,
} from 'typeorm'
import { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions'

import { View } from 'typeorm/schema-builder/view/View'
import { TestConnection } from './testConnection'

export const NIL_UUID = '00000000-0000-0000-0000-000000000000'

/**
 * Port of TypeORM protected function QueryRunner.escapePath
 *
 * https://github.com/typeorm/typeorm/blob/91d5b2fc374c2f7b1545d40ee76577272de21436/src/driver/postgres/PostgresQueryRunner.ts#L2333
 */
function escapePath(
    schema: string | undefined,
    target: Table | View | string
): string {
    let tableName =
        target instanceof Table || target instanceof View ? target.name : target
    tableName =
        tableName.indexOf('.') === -1 && schema
            ? `${schema}.${tableName}`
            : tableName

    return tableName
        .split('.')
        .map((i) => `"${i}"`)
        .join('.')
}

/**
 * Deletes all records for the specified Entities (defaults to all Entities if not specified)
 *
 * @param entities Array of Entity names or classes
 *
 * Inspiration:
 * - https://github.com/typeorm/typeorm/blob/91d5b2fc374c2f7b1545d40ee76577272de21436/src/driver/postgres/PostgresQueryRunner.ts#L1430
 * - https://github.com/typeorm/typeorm/blob/beea2e1e4429d13d7864ebc23aa6e58fa01647ea/src/driver/postgres/PostgresQueryRunner.ts#L1360
 * - https://github.com/django/django/blob/3f2170f720fe1e2b1030887684c18dc2fc20116b/django/db/backends/postgresql/operations.py#L122
 */
export async function truncateTables(
    dataSource: DataSource,
    entities?: EntityTarget<any>[]
): Promise<void> {
    if (entities && entities.length === 0) {
        return
    }

    let entityMetadatas: EntityMetadata[]
    if (entities === undefined) {
        // Default to all Entities
        entityMetadatas = dataSource.entityMetadatas
    } else {
        entityMetadatas = entities.map((entity) =>
            dataSource.getMetadata(entity)
        )
    }

    // TypeORM stores the driver as an abstract base type, but PostgresConnectionOptions (and some
    // other drivers) include a `schema` option. This cast is safer than to `any`
    const schema = (dataSource.driver.options as BaseDataSourceOptions & {
        schema?: string
    })?.schema

    // Escape (and include `schema` name if required) - this is done by TypeORM's QueryRunner.clearTable()
    const tableNames = entityMetadatas.map((metadata) =>
        escapePath(schema, metadata.tableName)
    )

    const queryRunner = dataSource.createQueryRunner()
    try {
        // Can't use `queryRunner.clearTable()` as this doesn't include CASCADE, and only supports
        // one table at a time (which is incredibly slow)
        await queryRunner.query(`TRUNCATE ${tableNames.join(', ')} CASCADE`)
    } finally {
        await queryRunner.release()
    }
}

/**
 * Finds a foreign key in the given table with the given name
 * @param testConnection - The connection where the table is located
 * @param tableName - The name of the table to search
 * @param foreignKeyName - The name of the foreign key to find
 */
export async function findForeignKeyByTableAndName(
    testConnection: TestConnection,
    tableName: string,
    foreignKeyName: string
) {
    const queryRunner = testConnection.createQueryRunner()
    const table = await queryRunner.getTable(tableName)
    const foreignKeys = table?.foreignKeys
    return foreignKeys?.find((fk) => fk.name === foreignKeyName)
}

/**
 * Replaces a given foreign key with a new one
 * @param testConnection - The connection where the table is located
 * @param tableName - The name of the tables that has the foreign key
 * @param currentForeignKey - The current foreign key to replace
 * @param newForeignKey - The new foreign key to replace with
 */
export async function updateForeignKey(
    testConnection: TestConnection,
    tableName: string,
    currentForeignKey: TableForeignKey,
    newForeignKey: TableForeignKey
) {
    const queryRunner = testConnection.createQueryRunner()
    // dropping original foreign key
    await queryRunner.dropForeignKey(tableName, currentForeignKey)
    // to be replaced by the new one
    await queryRunner.createForeignKey(tableName, newForeignKey)
}
