import { DataSource, QueryRunner } from 'typeorm'
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel'

/**
 * Wraps the original TypeORM query runner to intercept some calls
 * and manipulate the transactional context.
 */
interface QueryRunnerWrapper extends QueryRunner {
    startParentTransaction(): Promise<void>
    rollbackParentTransaction(): Promise<void>
    releaseQueryRunner(): Promise<void>
}

const wrap = (originalQueryRunner: QueryRunner): QueryRunnerWrapper => {
    const wrapper = originalQueryRunner as QueryRunnerWrapper

    // Move some methods to new namespace
    wrapper.startParentTransaction = originalQueryRunner.startTransaction
    wrapper.rollbackParentTransaction = originalQueryRunner.rollbackTransaction
    wrapper.releaseQueryRunner = originalQueryRunner.release

    // Modify methods to work for child transactions
    wrapper.startTransaction = async (
        isolationLevel?: IsolationLevel
    ): Promise<void> => {
        await originalQueryRunner.query(`SAVEPOINT nested_transaction`)
        if (isolationLevel) {
            await originalQueryRunner.query(
                'SET TRANSACTION ISOLATION LEVEL ' + isolationLevel
            )
        }
    }

    wrapper.commitTransaction = async (): Promise<void> => {
        await originalQueryRunner.query(`RELEASE SAVEPOINT nested_transaction`)
    }

    wrapper.rollbackTransaction = async (): Promise<void> => {
        await originalQueryRunner.query(
            `ROLLBACK TO SAVEPOINT nested_transaction`
        )
    }

    wrapper.release = () => Promise.resolve()

    return wrapper
}

/**
 * Makes all db operations run within a transaction.
 * Supports nested transactions.
 */
export default class TransactionalTestContext {
    private queryRunner: QueryRunnerWrapper | null = null
    private createQueryRunner = DataSource.prototype.createQueryRunner

    constructor(private readonly connection: DataSource) {}

    async start(): Promise<void> {
        if (this.queryRunner) {
            throw new Error('Context already started')
        }
        try {
            this.queryRunner = this.buildWrappedQueryRunner()
            this.disableQueryRunnerCreation(this.queryRunner)
            await this.queryRunner.connect()
            await this.queryRunner.startParentTransaction()
        } catch (error) {
            await this.cleanUpResources()
            throw error
        }
    }

    async finish(): Promise<void> {
        if (!this.queryRunner) {
            throw new Error(
                'Context not started. You must call "start" before finishing it.'
            )
        }
        try {
            await this.queryRunner.rollbackParentTransaction()
        } finally {
            await this.cleanUpResources()
        }
    }

    private buildWrappedQueryRunner(): QueryRunnerWrapper {
        const queryRunner = this.connection.createQueryRunner()
        return wrap(queryRunner)
    }

    private disableQueryRunnerCreation(queryRunner: QueryRunnerWrapper): void {
        DataSource.prototype.createQueryRunner = () => {
            return queryRunner
        }
    }

    private async cleanUpResources(): Promise<void> {
        DataSource.prototype.createQueryRunner = this.createQueryRunner
        if (this.queryRunner) {
            await this.queryRunner.releaseQueryRunner()
            this.queryRunner = null
        }
    }
}
