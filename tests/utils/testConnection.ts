import { Connection, createConnection, QueryRunner } from 'typeorm'
import { TypeORMLogger } from '../../src/logging'
import { getEnvVar } from '../../src/config/config'
import { max, min, sum } from 'lodash'
import * as fs from 'fs'

class QueryMetricsLogger extends TypeORMLogger {
    private counter = 0
    private wasReset = false
    private slowStats = new Map<string, number[]>()

    logQuery(
        query: string,
        parameters?: any[],
        queryRunner?: QueryRunner
    ): void {
        this.counter += 1
        super.logQuery(query, parameters, queryRunner)
    }

    logQuerySlow(
        time: number,
        query: string,
        parameters?: unknown[],
        queryRunner?: QueryRunner
    ) {
        const stats = this.slowStats.get(query) || []
        stats.push(time)
        this.slowStats.set(query, stats)
        super.logQuerySlow(time, query, parameters, queryRunner)
    }

    get slowQueryStats() {
        const results: {
            [key: string]: {
                total: number
                mean: number
                instances: number
                min: number | undefined
                max: number | undefined
            }
        } = {}

        for (const [query, times] of this.slowStats.entries()) {
            results[query] = {
                total: sum(times),
                mean: sum(times) / times.length,
                instances: times.length,
                min: min(times),
                max: max(times),
            }
        }
        return results
    }

    saveSlowQueryStats() {
        fs.writeFileSync(
            './slow_query_stats',
            JSON.stringify(this.slowQueryStats, null, 4)
        )
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
        this.slowStats = new Map()
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
    const RO_DATABASE_URL = getEnvVar('RO_DATABASE_URL', '')!
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
                url: getEnvVar(
                    'DATABASE_URL',
                    'postgres://postgres:kidsloop@localhost/testdb'
                ),
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
        url: getEnvVar(
            'DATABASE_URL',
            'postgres://postgres:kidsloop@localhost/testdb'
        ),
        synchronize,
        dropSchema: drop,
        migrations: ['migrations/*{.ts,.js}'],
        entities: ['src/entities/*{.ts,.js}'],
        logger: new QueryMetricsLogger(),
    }) as Promise<TestConnection>
}
