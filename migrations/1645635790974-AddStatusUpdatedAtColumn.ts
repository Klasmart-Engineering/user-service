import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddStatusUpdatedAtColumn1645635790974
    implements MigrationInterface {
    name = 'AddStatusUpdatedAtColumn1645635790974'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "school_membership" ADD "status_updated_at" TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ADD "status_updated_at" TIMESTAMP(3)`
        )
        await queryRunner.query(
            `UPDATE "school_membership" SET "status_updated_at" = "deleted_at"`
        )
        await queryRunner.query(
            `UPDATE "organization_membership" SET "status_updated_at" = "deleted_at"`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Any failure happening in the up() transaction will lead to it rolling back
        // Therefore we should not have anything in down() modifying any data
        // Especially because the change we are making here is purely ADDING data
    }
}
