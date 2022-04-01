import { MigrationInterface, QueryRunner } from 'typeorm'
import logger from '../src/logging'

export class CreateAcademicTermEntity1648053310507
    implements MigrationInterface {
    name = 'CreateAcademicTermEntity1648053310507'

    public async up(queryRunner: QueryRunner): Promise<void> {
        logger.info(
            'Running up migration: CreateAcademicTermEntity1648053310507'
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'academic_term_status_enum') THEN
                    CREATE TYPE "academic_term_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "academic_term" (
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP(3),
                "status" "academic_term_status_enum" NOT NULL DEFAULT 'active',
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "start_date" TIMESTAMP(3) NOT NULL,
                "end_date" TIMESTAMP(3) NOT NULL,
                "school_id" uuid NOT NULL,
                CONSTRAINT "PK_7b17dac59645103012db5b168e5" PRIMARY KEY ("id")
            )
        `)
        await queryRunner.query(`
            ALTER TABLE "class"
            ADD COLUMN IF NOT EXISTS "academic_term_id" uuid
        `)
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_a60c46b179f57cfac7a231b6455') THEN
                    ALTER TABLE "class"
                    ADD CONSTRAINT "FK_a60c46b179f57cfac7a231b6455" FOREIGN KEY ("academic_term_id") REFERENCES "academic_term"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_893384f83b94778c8f51b300592') THEN
                    ALTER TABLE "academic_term"
                    ADD CONSTRAINT "FK_893384f83b94778c8f51b300592" FOREIGN KEY ("school_id") REFERENCES "school"("school_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END$$;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        logger.info(
            'Running down migration: CreateAcademicTermEntity1648053310507'
        )
        await queryRunner.query(`
            ALTER TABLE "academic_term" DROP CONSTRAINT "FK_893384f83b94778c8f51b300592"
        `)
        await queryRunner.query(`
            ALTER TABLE "class" DROP CONSTRAINT "FK_a60c46b179f57cfac7a231b6455"
        `)
        await queryRunner.query(`
            ALTER TABLE "class" DROP COLUMN "academic_term_id"
        `)
        await queryRunner.query(`
            DROP TABLE "academic_term"
        `)
        await queryRunner.query(`
            DROP TYPE "academic_term_status_enum"
        `)
    }
}
