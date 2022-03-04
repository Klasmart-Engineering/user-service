import { MigrationInterface, QueryRunner } from 'typeorm'

export class OrganizationMembershipDeletionStatus1645033794324
    implements MigrationInterface {
    name = 'OrganizationMembershipDeletionStatus1645033794324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // postgres pre-12 can't alter enums in a transaction
        // so we have to instead create a whole new type
        // https://stackoverflow.com/a/10404041
        // https://stackoverflow.com/a/53150621

        await queryRunner.query(
            `ALTER TYPE organization_membership_status_enum RENAME to organization_membership_status_enum_old;`
        )
        await queryRunner.query(
            `CREATE TYPE organization_membership_status_enum AS enum ('active', 'inactive', 'deleted');`
        )

        // https://stackoverflow.com/questions/1771543/adding-a-new-value-to-an-existing-enum-type/10404041#comment33983819_3275885
        // While the default value is dropped we must lock the table
        // to avoid inserts that are relying on the default value
        await queryRunner.query(
            `LOCK TABLE organization_membership IN EXCLUSIVE MODE;`
        )

        // When a column has a default value, you have to drop this
        // before changing the enum type
        // https://stackoverflow.com/questions/1771543/adding-a-new-value-to-an-existing-enum-type#comment97094273_10404041
        await queryRunner.query(
            `ALTER TABLE organization_membership ALTER COLUMN status DROP DEFAULT;`
        )
        await queryRunner.query(
            `ALTER TABLE organization_membership ALTER COLUMN status TYPE organization_membership_status_enum USING status::text::organization_membership_status_enum;`
        )
        await queryRunner.query(
            `ALTER TABLE organization_membership ALTER COLUMN status SET DEFAULT 'active';`
        )
        await queryRunner.query(
            `DROP TYPE organization_membership_status_enum_old;`
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(queryRunner: QueryRunner): Promise<void> {}
}
