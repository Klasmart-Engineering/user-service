import { MigrationInterface, QueryRunner } from 'typeorm'

export class SchoolMembershipDeletionStatus1645438258990
    implements MigrationInterface {
    name = 'SchoolMembershipDeletionStatus1645438258990'
    public async up(queryRunner: QueryRunner): Promise<void> {
        // postgres pre-12 can't alter enums in a transaction
        // so we have to instead create a whole new type
        // https://stackoverflow.com/a/10404041
        // https://stackoverflow.com/a/53150621

        await queryRunner.query(
            `ALTER TYPE school_membership_status_enum RENAME to school_membership_status_enum_old;`
        )
        await queryRunner.query(
            `CREATE TYPE school_membership_status_enum AS enum ('active', 'inactive', 'deleted');`
        )

        // https://stackoverflow.com/questions/1771543/adding-a-new-value-to-an-existing-enum-type/10404041#comment33983819_3275885
        // While the default value is dropped we must lock the table
        // to avoid inserts that are relying on the default value
        await queryRunner.query(
            `LOCK TABLE school_membership IN EXCLUSIVE MODE;`
        )

        // When a column has a default value, you have to drop this
        // before changing the enum type
        // https://stackoverflow.com/questions/1771543/adding-a-new-value-to-an-existing-enum-type#comment97094273_10404041
        await queryRunner.query(
            `ALTER TABLE school_membership ALTER COLUMN status DROP DEFAULT;`
        )
        await queryRunner.query(
            `ALTER TABLE school_membership ALTER COLUMN status TYPE school_membership_status_enum USING status::text::school_membership_status_enum;`
        )
        await queryRunner.query(
            `ALTER TABLE school_membership ALTER COLUMN status SET DEFAULT 'active';`
        )
        await queryRunner.query(`DROP TYPE school_membership_status_enum_old;`)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(queryRunner: QueryRunner): Promise<void> {}
}
