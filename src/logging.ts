import pino from 'pino'
import { QueryRunner, Logger as BaseTypeORMLogger } from 'typeorm'

// pino.Logger (return type of pino()) includes {[key: string]: LogFn}, which is unecessarily type widening
export type Logger = pino.BaseLogger

const loggerOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: [
        'email',
        'phone',
        'alternate_email',
        'alternate_phone',
        'user_name',
        'full_name',
        'given_name',
        'family_name',
        'token',
    ],
}

export const logger: Logger =
    process.env.NODE_ENV === 'production'
        ? pino(
              loggerOptions,
              pino.destination({
                  minLength: 4096,
                  sync: false,
              })
          )
        : pino(loggerOptions)

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
    readonly logger: Logger

    constructor(logger: Logger) {
        this.logger = logger
    }

    logQuery(
        query: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters?: any[],
        queryRunner?: QueryRunner
    ) {
        this.logger.debug({
            query: normalizeQuery(query),
            parameters,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logQueryError(
        error: string | Error,
        query: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters?: any[],
        queryRunner?: QueryRunner
    ) {
        this.logger.error({
            err: typeof error === 'string' ? new Error(error) : error,
            query: normalizeQuery(query),
            parameters,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logQuerySlow(
        time: number,
        query: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters?: any[],
        queryRunner?: QueryRunner
    ) {
        this.logger.warn({
            query: normalizeQuery(query),
            parameters,
            time,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logSchemaBuild(message: string, queryRunner?: QueryRunner) {
        this.logger.debug({
            msg: message,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    logMigration(message: string, queryRunner?: QueryRunner) {
        this.logger.debug({
            msg: message,
            ...extractInfoFromQueryRunner(queryRunner),
        })
    }

    log(
        level: 'log' | 'info' | 'warn',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: any,
        queryRunner?: QueryRunner
    ) {
        switch (level) {
            case 'log':
                this.logger.info({
                    msg: message,
                    ...extractInfoFromQueryRunner(queryRunner),
                })
                break
            case 'info':
                this.logger.debug({
                    msg: message,
                    ...extractInfoFromQueryRunner(queryRunner),
                })
                break
            case 'warn':
                this.logger.warn({
                    msg: message,
                    ...extractInfoFromQueryRunner(queryRunner),
                })
                break
        }
    }
}

export default logger
