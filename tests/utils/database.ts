import { Connection, EntityMetadata, EntityTarget, Table } from 'typeorm'
import { BaseConnectionOptions } from 'typeorm/connection/BaseConnectionOptions'
import { View } from 'typeorm/schema-builder/view/View'

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
    connection: Connection,
    entities?: EntityTarget<any>[]
): Promise<void> {
    if (entities && entities.length === 0) {
        return
    }

    let entityMetadatas: EntityMetadata[]
    if (entities === undefined) {
        // Default to all Entities
        entityMetadatas = connection.entityMetadatas
    } else {
        entityMetadatas = entities.map((entity) =>
            connection.getMetadata(entity)
        )
    }

    // TypeORM stores the driver as an abstract base type, but PostgresConnectionOptions (and some
    // other drivers) include a `schema` option. This cast is safer than to `any`
    const schema = (connection.driver.options as BaseConnectionOptions & {
        schema?: string
    })?.schema

    // Escape (and include `schema` name if required) - this is done by TypeORM's QueryRunner.clearTable()
    const tableNames = entityMetadatas.map((metadata) =>
        escapePath(schema, metadata.tableName)
    )

    const queryRunner = connection.createQueryRunner()
    try {
        // Can't use `queryRunner.clearTable()` as this doesn't include CASCADE, and only supports
        // one table at a time (which is incredibly slow)
        await queryRunner.query(`TRUNCATE ${tableNames.join(', ')} CASCADE`)
    } finally {
        await queryRunner.release()
    }
}
