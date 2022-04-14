import { Connection, QueryRunner } from 'typeorm'
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
    private createQueryRunner = Connection.prototype.createQueryRunner

    constructor(private readonly connection: Connection) {}

    async start(): Promise<void> {
        if (this.queryRunner) {
            throw new Error('Context already started')
        }
        try {
            this.queryRunner = this.buildWrappedQueryRunner()
            this.disableQueryRunnerCreation()
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

    // only call this externally if you've previously called restoreCreateQueryRunner
    // and want to undo its effect
    public disableQueryRunnerCreation(): void {
        if (this.queryRunner === null) {
            throw new Error(
                'this.queryRunner is undefined so cannot replace createQueryRunner'
            )
        } else {
            Connection.prototype.createQueryRunner = () => {
                Connection.prototype
                return this.queryRunner as QueryRunnerWrapper
            }
        }
    }

    // this should only be used for tests that require commited data in the database.
    // For example: in code that uses 2 connections, one using a transaction
    // and depends on the second connection not seeing uncommitted data from the transaction.
    public restoreCreateQueryRunner() {
        Connection.prototype.createQueryRunner = this.createQueryRunner
    }

    private async cleanUpResources(): Promise<void> {
        this.restoreCreateQueryRunner()
        if (this.queryRunner) {
            await this.queryRunner.releaseQueryRunner()
            this.queryRunner = null
        }
    }
}
