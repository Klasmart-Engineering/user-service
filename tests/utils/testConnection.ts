import { Connection, createConnection, QueryRunner } from 'typeorm'
import logger, { TypeORMLogger } from '../../src/logging'

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
    return createConnection({
        name: name,
        type: 'postgres',
        synchronize: synchronize,
        dropSchema: drop,
        entities: ['src/entities/*.ts'],
        logger: new QueryMetricsLogger(logger),
        replication: {
            master: {
                url:
                    process.env.DATABASE_URL ||
                    'postgres://postgres:kidsloop@localhost/testdb',
            },
            slaves: process.env.RO_DATABASE_URL
                ? [
                      {
                          url: process.env.RO_DATABASE_URL,
                      },
                  ]
                : [],
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
        url:
            process.env.DATABASE_URL ||
            'postgres://postgres:kidsloop@localhost/testdb',
        synchronize,
        dropSchema: drop,
        migrations: ['migrations/*.ts'],
        entities: ['src/entities/*.ts'],
        logger: new QueryMetricsLogger(logger),
    }) as Promise<TestConnection>
}
