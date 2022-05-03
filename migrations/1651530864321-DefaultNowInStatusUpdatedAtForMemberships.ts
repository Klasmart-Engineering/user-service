import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'
import logger from '../src/logging'

export class DefaultNowInStatusUpdatedAtForMemberships1651530864321
    implements MigrationInterface {
    public name = 'DefaultNowInStatusUpdatedAtForMemberships1651530864321'
    private columnName = 'status_updated_at'
    private orgMembershipTableName = 'organization_membership'
    private schoolMembershipTableName = 'school_membership'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const now = 'now()'

        logger.info(
            `Setting default value for ${this.columnName} in ${this.orgMembershipTableName}`
        )
        await this.setDefaultInColumn(
            queryRunner,
            this.orgMembershipTableName,
            now
        )

        logger.info(
            `Setting default value for ${this.columnName} in ${this.schoolMembershipTableName}`
        )
        await this.setDefaultInColumn(
            queryRunner,
            this.schoolMembershipTableName,
            now
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        logger.info(
            `Removing default value for ${this.columnName} in ${this.orgMembershipTableName}`
        )
        await this.setDefaultInColumn(queryRunner, this.orgMembershipTableName)

        logger.info(
            `Removing default value for ${this.columnName} in ${this.schoolMembershipTableName}`
        )
        await this.setDefaultInColumn(
            queryRunner,
            this.schoolMembershipTableName
        )
    }

    private async setDefaultInColumn(
        queryRunner: QueryRunner,
        tableName: string,
        value?: string
    ): Promise<void> {
        const table = await queryRunner.getTable(tableName)
        const column = table?.findColumnByName(this.columnName)

        if (column) {
            const newColumn = new TableColumn({
                ...column,
                default: value,
            })

            await queryRunner.changeColumn(tableName, column, newColumn)
        }
    }
}
