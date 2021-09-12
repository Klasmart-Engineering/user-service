import {
    AdvancedConsoleLogger,
    Connection,
    createConnection,
    QueryRunner,
} from 'typeorm'
import { LoggerOptions } from 'typeorm/logger/LoggerOptions'

class QueryMetricsLogger extends AdvancedConsoleLogger {
    private counter = 0
    private wasReset = false

    // LoggerOptions must be passed directly to QueryMetricsLogger
    // passing them via createConnection({logging: ...}) does not work with custom loggers
    // because they must already be instantiated before createConnection is called
    constructor(options?: LoggerOptions) {
        super(options)
    }

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

export const createTestConnection = async (
    drop: boolean = false,
    name: string = 'default'
): Promise<TestConnection> => {
    const logger = new QueryMetricsLogger()
    return createConnection({
        name: name,
        type: 'postgres',
        synchronize: drop,
        dropSchema: drop,
        entities: ['src/entities/*.ts'],
        logger,
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
    drop: boolean = false,
    synchronize: boolean = false,
    name: string = 'default'
): Promise<TestConnection> => {
    const logger = new QueryMetricsLogger()
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
        logger,
    }) as Promise<TestConnection>
}
