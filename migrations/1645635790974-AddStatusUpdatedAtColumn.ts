import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddStatusUpdatedAtColumn1645635790974
    implements MigrationInterface {
    name = 'AddStatusUpdatedAtColumn1645635790974'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_membership' AND column_name='status_updated_at') THEN
                    ALTER TABLE "school_membership" ADD "status_updated_at" TIMESTAMP(3);
                    UPDATE "school_membership" SET "status_updated_at" = "deleted_at";
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_membership' AND column_name='status_updated_at') THEN
                    ALTER TABLE "organization_membership" ADD "status_updated_at" TIMESTAMP(3);
                    UPDATE "organization_membership" SET "status_updated_at" = "deleted_at";
                END IF;
            END$$;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Any failure happening in the up() transaction will lead to it rolling back
        // Therefore we should not have anything in down() modifying any data
        // Especially because the change we are making here is purely ADDING data
    }
}
