import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIdProviderColumnToUser1642080667584
    implements MigrationInterface {
    name = 'AddIdProviderColumnToUser1642080667584'
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "id_provider" character varying NULL`
        )
        await queryRunner.query(
            `COMMENT ON COLUMN "user"."id_provider" IS 'Used in combination with username to uniquely identify an MCB user'`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_USERNAME_ID_PROVIDER') THEN
                    ALTER TABLE "user" ADD CONSTRAINT "UQ_USERNAME_ID_PROVIDER" UNIQUE ("username", "id_provider");
                END IF;
            END$$;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "id_provider"`)
    }
}
