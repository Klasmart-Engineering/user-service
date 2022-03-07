import { QueryRunner, Logger as BaseTypeORMLogger } from 'typeorm'
import { KLLogger, withLogger } from '@kl-engineering/kidsloop-nodejs-logger'

export const logger: KLLogger = withLogger('')

const normalizeQuery = (query: string) => query.replace(/\s\s+/g, ' ').trim()

function extractInfoFromQueryRunner(
    queryRunner?: QueryRunner
): Record<string, never> | { transaction: boolean } {
    if (!queryRunner) return {}
    return {
        transaction: queryRunner.isTransactionActive,
    }
}

// Based on https://github.com/jtmthf/nestjs-pino-logger/issues/2#issuecomment-902947243
// and https://github.com/Ginden/entertainment-website/blob/37399a583d211cd2cdf2d4407f3652d10f97b9b2/services/main/src/logger/typeorm-logger.ts
export class TypeORMLogger implements BaseTypeORMLogger {
    readonly logger: KLLogger = withLogger('typeorm')

    logQuery(query: string, parameters?: unknown[], queryRunner?: QueryRunner) {
        this.logger.log('debug', '%o', {
            query: normalizeQuery(query),
            parameters,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logQueryError(
        error: string | Error,
        query: string,
        parameters?: unknown[],
        queryRunner?: QueryRunner
    ) {
        this.logger.log('error', '%o', {
            err: typeof error === 'string' ? new Error(error) : error,
            query: normalizeQuery(query),
            parameters,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logQuerySlow(
        time: number,
        query: string,
        parameters?: unknown[],
        queryRunner?: QueryRunner
    ) {
        this.logger.log('warn', '%o', {
            query: normalizeQuery(query),
            parameters,
            time,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logSchemaBuild(message: string, queryRunner?: QueryRunner) {
        this.logger.log('debug', '%o', {
            msg: message,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logMigration(message: string, queryRunner?: QueryRunner) {
        this.logger.log('debug', '%o', {
            msg: message,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    log(
        level: 'log' | 'info' | 'warn',
        message: unknown,
        queryRunner?: QueryRunner
    ) {
        switch (level) {
            case 'log':
                this.logger.log('info', '%o', {
                    msg: message,
                    ...extractInfoFromQueryRunner(queryRunner),
                })
                break
            case 'info':
                this.logger.log('debug', '%o', {
                    msg: message,
                    ...extractInfoFromQueryRunner(queryRunner),
                })
                break
            case 'warn':
                this.logger.log('warn', '%o', {
                    msg: message,
                    ...extractInfoFromQueryRunner(queryRunner),
                })
                break
        }
    }
}

export default logger
