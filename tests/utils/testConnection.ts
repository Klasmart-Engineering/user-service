import { Connection, createConnection, QueryRunner } from 'typeorm'
import { TypeORMLogger } from '../../src/logging'
import { getEnv } from '../../src/config/config'

class QueryMetricsLogger extends TypeORMLogger {
    private counter = 0
    private wasReset = false

    logQuery(
        query: string,
        parameters?: any[],
        queryRunner?: QueryRunner
    ): void {
        this.counter += 1
        super.logQuery(query, parameters, queryRunner)
    }

    get count(): number {
        if (!this.wasReset) {
            throw new Error(
                "Must call reset between counts to ensure you're counting the right queries"
            )
        }
        this.wasReset = false
        return this.counter
    }
    reset(): void {
        this.wasReset = true
        this.counter = 0
    }
}

export interface TestConnection extends Connection {
    logger: QueryMetricsLogger
}

export const createTestConnection = async ({
    drop = false,
    synchronize = false,
    name = 'default',
} = {}): Promise<TestConnection> => {
    const RO_DATABASE_URL = getEnv({ name: 'RO_DATABASE_URL' })
    const slavesURLList = RO_DATABASE_URL
                ? [
                      {
                          url: RO_DATABASE_URL,
                      },
                  ]
                : []

    return createConnection({
        name: name,
        type: 'postgres',
        synchronize: synchronize,
        dropSchema: drop,
        entities: ['src/entities/*{.ts,.js}'],
        logger: new QueryMetricsLogger(),
        replication: {
            master: {
                url: getEnv({
                    name: 'DATABASE_URL',
                    orDefault: 'postgres://postgres:kidsloop@localhost/testdb',
                }),
            },
            slaves: slavesURLList,
        },
    }) as Promise<TestConnection>
}

export const createMigrationsTestConnection = async (
    drop = false,
    synchronize = false,
    name = 'default'
): Promise<TestConnection> => {
    return createConnection({
        name: name,
        type: 'postgres',
        url: getEnv({
            name: 'DATABASE_URL',
            orDefault: 'postgres://postgres:kidsloop@localhost/testdb',
        }),
        synchronize,
        dropSchema: drop,
        migrations: ['migrations/*{.ts,.js}'],
        entities: ['src/entities/*{.ts,.js}'],
        logger: new QueryMetricsLogger(),
    }) as Promise<TestConnection>
}