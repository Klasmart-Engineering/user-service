import { Connection } from 'typeorm'

export async function getDatabaseTables(connection: Connection) {
    const tables = (await connection.createQueryRunner().query(`
        SELECT table_name
            FROM information_schema.tables
        WHERE table_schema='public'
            AND table_type='BASE TABLE';
    `)) as { table_name: string }[]

    return tables.map((table) => table.table_name)
}
