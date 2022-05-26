import { DataSource, QueryRunner } from 'typeorm'

/**
 * Wraps the original TypeORM query runner to intercept some calls
 * and manipulate the transactional context.
 */
type QueryRunnerWrapper = QueryRunner & { releaseQueryRunner(): Promise<void> }

/**
 * Makes all db operations run within a transaction.
 * Supports nested transactions.
 */
export default class TransactionalTestContext {
    private queryRunner: QueryRunnerWrapper | null = null
    private createQueryRunner = DataSource.prototype.createQueryRunner

    constructor(private readonly dataSource: DataSource) {}

    async start(): Promise<void> {
        if (this.queryRunner) throw new Error('Context already started')

        try {
            this.queryRunner = this.buildWrappedQueryRunner()
            this.disableQueryRunnerCreation()
            await this.queryRunner.connect()
            await this.queryRunner.startTransaction()
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
            await this.queryRunner.rollbackTransaction()
        } finally {
            await this.cleanUpResources()
        }
    }

    private buildWrappedQueryRunner(): QueryRunnerWrapper {
        const queryRunner = this.dataSource.createQueryRunner() as QueryRunnerWrapper
        queryRunner.releaseQueryRunner = queryRunner.release
        queryRunner.release = () => Promise.resolve()
        return queryRunner
    }

    // only call this externally if you've previously called restoreCreateQueryRunner
    // and want to undo its effect
    public disableQueryRunnerCreation(): void {
        if (this.queryRunner === null) {
            throw new Error(
                'this.queryRunner is undefined so cannot replace createQueryRunner'
            )
        } else {
            DataSource.prototype.createQueryRunner = () => {
                return this.queryRunner!
            }
        }
    }

    // this should only be used for tests that require committed data in the database.
    // For example: in code that uses 2 connections, one using a transaction
    // and depends on the second connection not seeing uncommitted data from the transaction.
    public restoreCreateQueryRunner() {
        DataSource.prototype.createQueryRunner = this.createQueryRunner
    }

    private async cleanUpResources(): Promise<void> {
        this.restoreCreateQueryRunner()
        if (this.queryRunner) {
            await this.queryRunner.releaseQueryRunner()
            this.queryRunner = null
        }
    }
}
