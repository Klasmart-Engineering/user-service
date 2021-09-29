import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTimestampColumns1630420895212 implements MigrationInterface {
    name = 'AddTimestampColumns1630420895212'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "grade" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "permission" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "permission" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "permission" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_status_enum') THEN
                    CREATE TYPE "permission_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `ALTER TABLE "permission" ADD COLUMN IF NOT EXISTS "status" "permission_status_enum" NOT NULL DEFAULT 'active'`
        )
        await queryRunner.query(
            `ALTER TABLE "role" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "role" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "subcategory" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "subject" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "program" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "school" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "school" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_ownership" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_ownership" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "branding_image" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "age_range" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()`
        )
        await queryRunner.query(
            `ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
                    CREATE TYPE "attendance_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "status" "attendance_status_enum" NOT NULL DEFAULT 'active'`
        )
        await queryRunner.query(
            `ALTER TABLE "grade" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "grade" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "role" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "subcategory" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "subcategory" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "category" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "category" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "subject" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "subject" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "program" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "program" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "school" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "class" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_ownership" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "user" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding_image" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding_image" ALTER COLUMN "updated_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding" ALTER COLUMN "updated_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "age_range" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`
        )
        await queryRunner.query(
            `ALTER TABLE "age_range" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(3)`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "age_range" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "age_range" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding" ALTER COLUMN "updated_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding_image" ALTER COLUMN "updated_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "branding_image" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "user" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_ownership" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "class" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "school" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "program" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "program" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "subject" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "subject" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "category" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "category" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "subcategory" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "subcategory" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "role" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "grade" ALTER COLUMN "deleted_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(
            `ALTER TABLE "grade" ALTER COLUMN "created_at" TYPE TIMESTAMP(6)`
        )
        await queryRunner.query(`ALTER TABLE "attendance" DROP COLUMN "status"`)
        await queryRunner.query(`DROP TYPE "attendance_status_enum"`)
        await queryRunner.query(
            `ALTER TABLE "attendance" DROP COLUMN "deleted_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "attendance" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "attendance" DROP COLUMN "created_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "age_range" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization" DROP COLUMN "created_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "branding" DROP COLUMN "deleted_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "branding_image" DROP COLUMN "deleted_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP COLUMN "created_at"`
        )
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "updated_at"`)
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "created_at"`)
        await queryRunner.query(
            `ALTER TABLE "organization_ownership" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_ownership" DROP COLUMN "created_at"`
        )
        await queryRunner.query(`ALTER TABLE "class" DROP COLUMN "updated_at"`)
        await queryRunner.query(`ALTER TABLE "class" DROP COLUMN "created_at"`)
        await queryRunner.query(`ALTER TABLE "school" DROP COLUMN "updated_at"`)
        await queryRunner.query(`ALTER TABLE "school" DROP COLUMN "created_at"`)
        await queryRunner.query(
            `ALTER TABLE "program" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "subject" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "category" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "subcategory" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP COLUMN "created_at"`
        )
        await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "updated_at"`)
        await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "created_at"`)
        await queryRunner.query(`ALTER TABLE "permission" DROP COLUMN "status"`)
        await queryRunner.query(`DROP TYPE "permission_status_enum"`)
        await queryRunner.query(
            `ALTER TABLE "permission" DROP COLUMN "deleted_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "permission" DROP COLUMN "updated_at"`
        )
        await queryRunner.query(
            `ALTER TABLE "permission" DROP COLUMN "created_at"`
        )
        await queryRunner.query(`ALTER TABLE "grade" DROP COLUMN "updated_at"`)
    }
}
