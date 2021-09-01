import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialState1628677180503 implements MigrationInterface {
    name = 'InitialState1628677180503'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('Starting initial state database migration...')

        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grade_status_enum') THEN
                    CREATE TYPE "grade_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "grade" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "system" boolean NOT NULL DEFAULT false, "status" "grade_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "progress_from_grade_id" uuid, "progress_to_grade_id" uuid, "organization_id" uuid, CONSTRAINT "PK_58c2176c3ae96bf57daebdbcb5e" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "permission" ("permission_id" character varying NOT NULL, "permission_name" character varying, "allow" boolean NOT NULL, "permission_category" character varying, "permission_group" character varying, "permission_level" character varying, "permission_description" character varying, CONSTRAINT "PK_aaa6d61e22fb453965ae6157ce5" PRIMARY KEY ("permission_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_status_enum') THEN
                    CREATE TYPE "role_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "role" ("role_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_name" character varying, "status" "role_status_enum" NOT NULL DEFAULT 'active', "deleted_at" TIMESTAMP, "role_description" character varying NOT NULL DEFAULT 'System Default Role', "system_role" boolean NOT NULL DEFAULT false, "organizationOrganizationId" uuid, CONSTRAINT "PK_df46160e6aa79943b83c81e496e" PRIMARY KEY ("role_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_membership_status_enum') THEN
                    CREATE TYPE "school_membership_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "school_membership" ("user_id" character varying NOT NULL, "school_id" character varying NOT NULL, "status" "school_membership_status_enum" NOT NULL DEFAULT 'active', "join_timestamp" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "userUserId" uuid, "schoolSchoolId" uuid, CONSTRAINT "PK_8460e14e1fbe5cea7ec60a282dc" PRIMARY KEY ("user_id", "school_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subcategory_status_enum') THEN
                    CREATE TYPE "subcategory_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "subcategory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "system" boolean NOT NULL DEFAULT false, "status" "subcategory_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid, CONSTRAINT "PK_5ad0b82340b411f9463c8e9554d" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_status_enum') THEN
                    CREATE TYPE "category_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "system" boolean NOT NULL DEFAULT false, "status" "category_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid, CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_status_enum') THEN
                    CREATE TYPE "subject_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "subject" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "system" boolean NOT NULL DEFAULT false, "status" "subject_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid, CONSTRAINT "PK_12eee115462e38d62e5455fc054" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'program_status_enum') THEN
                    CREATE TYPE "program_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "program" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "system" boolean NOT NULL DEFAULT false, "status" "program_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid, CONSTRAINT "PK_3bade5945afbafefdd26a3a29fb" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_status_enum') THEN
                    CREATE TYPE "school_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "school" ("school_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "school_name" character varying NOT NULL, "shortcode" character varying(10), "status" "school_status_enum" NOT NULL DEFAULT 'active', "deleted_at" TIMESTAMP, "organizationOrganizationId" uuid, CONSTRAINT "CHK_96245082715fb7b556049b3793" CHECK ("school_name" <> ''), CONSTRAINT "PK_6af289a297533c116e251f90c08" PRIMARY KEY ("school_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status_enum') THEN
                    CREATE TYPE "class_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "class" ("class_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_name" character varying NOT NULL, "status" "class_status_enum" NOT NULL DEFAULT 'active', "shortcode" character varying(10), "deleted_at" TIMESTAMP, "organizationOrganizationId" uuid, CONSTRAINT "UQ_8492419af3e16a19b030d49546f" UNIQUE ("class_name", "organizationOrganizationId"), CONSTRAINT "CHK_090129622ea775ac18fa6efb2a" CHECK ("class_name" <> ''), CONSTRAINT "PK_4265c685fe8a9043bd8d400ad58" PRIMARY KEY ("class_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_ownership_status_enum') THEN
                    CREATE TYPE "organization_ownership_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "organization_ownership" ("user_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "status" "organization_ownership_status_enum" NOT NULL DEFAULT 'active', "deleted_at" TIMESTAMP, CONSTRAINT "REL_af092fb11378f417fa5c47f367" UNIQUE ("user_id"), CONSTRAINT "REL_f6a339c08dd0262ce0639091b7" UNIQUE ("organization_id"), CONSTRAINT "PK_9e63a489464140b82179bdf5bec" PRIMARY KEY ("user_id", "organization_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
                    CREATE TYPE "user_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "user" ("user_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "given_name" character varying, "family_name" character varying, "username" character varying, "email" character varying, "phone" character varying, "date_of_birth" character varying, "gender" character varying, "avatar" character varying, "status" "user_status_enum" NOT NULL DEFAULT 'active', "deleted_at" TIMESTAMP, "primary" boolean NOT NULL DEFAULT false, "alternate_email" character varying, "alternate_phone" character varying, "myOrganizationOrganizationId" uuid, CONSTRAINT "REL_2af3e757ddd2c6ae0598b094b0" UNIQUE ("myOrganizationOrganizationId"), CONSTRAINT "PK_758b8ce7c18b9d347461b30228d" PRIMARY KEY ("user_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_membership_status_enum') THEN
                    CREATE TYPE "organization_membership_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "organization_membership" ("user_id" character varying NOT NULL, "organization_id" character varying NOT NULL, "status" "organization_membership_status_enum" NOT NULL DEFAULT 'active', "join_timestamp" TIMESTAMP NOT NULL DEFAULT now(), "shortcode" character varying(16), "deleted_at" TIMESTAMP, "userUserId" uuid, "organizationOrganizationId" uuid, CONSTRAINT "PK_4c0dd6adaf8fc161026db004550" PRIMARY KEY ("user_id", "organization_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branding_image_status_enum') THEN
                    CREATE TYPE "branding_image_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "branding_image" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tag" character varying NOT NULL, "url" character varying NOT NULL, "status" "branding_image_status_enum" NOT NULL DEFAULT 'active', "branding_id" uuid, CONSTRAINT "PK_59577d335561e2a2a19beb2885e" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branding_status_enum') THEN
                    CREATE TYPE "branding_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "branding" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT  now(), "primary_color" text, "status" "branding_status_enum" NOT NULL DEFAULT 'active', "organization_id" uuid, CONSTRAINT "UQ_76c80b06b6946bc95459a01918c" UNIQUE ("organization_id"), CONSTRAINT "REL_76c80b06b6946bc95459a01918" UNIQUE ("organization_id"), CONSTRAINT "PK_e25f376c40ba766f4008a88bbc9" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status_enum') THEN
                    CREATE TYPE "organization_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "organization" ("organization_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_name" character varying, "address1" character varying, "address2" character varying, "phone" character varying, "shortCode" character varying(10), "status" "organization_status_enum" NOT NULL DEFAULT 'active', "deleted_at" TIMESTAMP, "primaryContactUserId" uuid, CONSTRAINT "PK_ed1251fa3856cd1a6c98d7bcaa3" PRIMARY KEY ("organization_id"))`
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_range_high_value_unit_enum') THEN
                    CREATE TYPE "age_range_high_value_unit_enum" AS ENUM('month', 'year');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_range_low_value_unit_enum') THEN
                    CREATE TYPE "age_range_low_value_unit_enum" AS ENUM('month', 'year');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_range_status_enum') THEN
                    CREATE TYPE "age_range_status_enum" AS ENUM('active', 'inactive');
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "age_range" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "high_value" integer NOT NULL, "low_value" integer NOT NULL, "high_value_unit" "age_range_high_value_unit_enum" NOT NULL, "low_value_unit" "age_range_low_value_unit_enum" NOT NULL, "system" boolean NOT NULL DEFAULT false, "status" "age_range_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid, CONSTRAINT "UQ_afa8f5126d119a7a669752017b3" UNIQUE ("low_value", "high_value", "low_value_unit", "high_value_unit", "organization_id"), CONSTRAINT "CHK_f9addaa54d47ea675848684c38" CHECK ("high_value" > 0 AND "high_value" <= 99), CONSTRAINT "CHK_40ca83a3cccb2b45b8d379dc20" CHECK ("low_value" >= 0 AND "low_value" <= 99), CONSTRAINT "PK_4c404ea3863e76f5169b5b1c691" PRIMARY KEY ("id"))`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "attendance" ("session_id" character varying NOT NULL, "join_timestamp" TIMESTAMP NOT NULL, "leave_timestamp" TIMESTAMP NOT NULL, "room_id" character varying NOT NULL, "user_id" character varying NOT NULL, CONSTRAINT "PK_6faeaae2bb6960b5ca7728ac6c8" PRIMARY KEY ("session_id", "join_timestamp", "leave_timestamp"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_7e820f3d6344144d583e6101d4" ON "attendance" ("room_id") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_0bedbcc8d5f9b9ec4979f51959" ON "attendance" ("user_id") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "permission_roles_role" ("permissionPermissionId" character varying NOT NULL, "roleRoleId" uuid NOT NULL, CONSTRAINT "PK_6307b540c85d8a7478af4e70349" PRIMARY KEY ("permissionPermissionId", "roleRoleId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_239d4448a254314c575ebee4b1" ON "permission_roles_role" ("permissionPermissionId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_ead8ac61d0fb420cde0ff36c82" ON "permission_roles_role" ("roleRoleId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "role_memberships_organization_membership" ("roleRoleId" uuid NOT NULL, "organizationMembershipUserId" character varying NOT NULL, "organizationMembershipOrganizationId" character varying NOT NULL, CONSTRAINT "PK_2fd508e51b02927a5d0de7669fd" PRIMARY KEY ("roleRoleId", "organizationMembershipUserId", "organizationMembershipOrganizationId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_d64a77ccb60c7223cdb7503af2" ON "role_memberships_organization_membership" ("roleRoleId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_6bb7ea4e331c11a6a821e383b0" ON "role_memberships_organization_membership" ("organizationMembershipUserId", "organizationMembershipOrganizationId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "role_school_memberships_school_membership" ("roleRoleId" uuid NOT NULL, "schoolMembershipUserId" character varying NOT NULL, "schoolMembershipSchoolId" character varying NOT NULL, CONSTRAINT "PK_1c14964d630a9d9e274b3a78916" PRIMARY KEY ("roleRoleId", "schoolMembershipUserId", "schoolMembershipSchoolId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_717cd0804a1388fa0efd196903" ON "role_school_memberships_school_membership" ("roleRoleId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_d7559cc316aba6912fed713ea9" ON "role_school_memberships_school_membership" ("schoolMembershipUserId", "schoolMembershipSchoolId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "category_subcategories_subcategory" ("categoryId" uuid NOT NULL, "subcategoryId" uuid NOT NULL, CONSTRAINT "PK_fb62a8ad61e9b1c377e20b4d21e" PRIMARY KEY ("categoryId", "subcategoryId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_24e438cea0fd95cb8f2e33ea11" ON "category_subcategories_subcategory" ("categoryId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_85f1569ff88406212e23f628db" ON "category_subcategories_subcategory" ("subcategoryId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "subject_categories_category" ("subjectId" uuid NOT NULL, "categoryId" uuid NOT NULL, CONSTRAINT "PK_64396015fc343638326f277d42e" PRIMARY KEY ("subjectId", "categoryId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_95dd6c21c5a4818ccbd5549979" ON "subject_categories_category" ("subjectId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_62e7f20e2c55a247829318c756" ON "subject_categories_category" ("categoryId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "program_age_ranges_age_range" ("programId" uuid NOT NULL, "ageRangeId" uuid NOT NULL, CONSTRAINT "PK_cbce3de8146f323e6868c21a76d" PRIMARY KEY ("programId", "ageRangeId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_3d4870570803ada96985442de1" ON "program_age_ranges_age_range" ("programId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_d1ccc2d2e2f6e8632e60bd2f72" ON "program_age_ranges_age_range" ("ageRangeId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "program_grades_grade" ("programId" uuid NOT NULL, "gradeId" uuid NOT NULL, CONSTRAINT "PK_d49fc599349f4032da8735319d4" PRIMARY KEY ("programId", "gradeId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_be11f6d4e92b35e388d77a5890" ON "program_grades_grade" ("programId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_80d7479d3b77c2b1269bd91bb5" ON "program_grades_grade" ("gradeId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "program_subjects_subject" ("programId" uuid NOT NULL, "subjectId" uuid NOT NULL, CONSTRAINT "PK_ee45942daf534489df82f446502" PRIMARY KEY ("programId", "subjectId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_be85e983b2d960972cf859013d" ON "program_subjects_subject" ("programId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_051e21c8a1d95f59de130a110e" ON "program_subjects_subject" ("subjectId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "school_classes_class" ("schoolSchoolId" uuid NOT NULL, "classClassId" uuid NOT NULL, CONSTRAINT "PK_ed0b30678e2e3b3047dc598ccf6" PRIMARY KEY ("schoolSchoolId", "classClassId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_9f897b46976c7c9183231d517b" ON "school_classes_class" ("schoolSchoolId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_444600a32c9885b46939d304c1" ON "school_classes_class" ("classClassId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "school_programs_program" ("schoolSchoolId" uuid NOT NULL, "programId" uuid NOT NULL, CONSTRAINT "PK_760837bfc79de77778724a916bf" PRIMARY KEY ("schoolSchoolId", "programId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_6d02461da423605ef9ccc3512b" ON "school_programs_program" ("schoolSchoolId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_a58b3085a8ec33fdeb2162d80a" ON "school_programs_program" ("programId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "class_programs_program" ("classClassId" uuid NOT NULL, "programId" uuid NOT NULL, CONSTRAINT "PK_25d5b747b7bb35e3fe3b7f9e4a3" PRIMARY KEY ("classClassId", "programId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_6e6cf742a4c6845df0a2f866ad" ON "class_programs_program" ("classClassId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_f4bcd89eaf5f669193ac33c160" ON "class_programs_program" ("programId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "class_age_ranges_age_range" ("classClassId" uuid NOT NULL, "ageRangeId" uuid NOT NULL, CONSTRAINT "PK_1507a42105236fbad0d1f6b2e88" PRIMARY KEY ("classClassId", "ageRangeId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_6d31d313b7d9507824f0686a8e" ON "class_age_ranges_age_range" ("classClassId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_aebc225830a42f04f6eb63f378" ON "class_age_ranges_age_range" ("ageRangeId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "class_grades_grade" ("classClassId" uuid NOT NULL, "gradeId" uuid NOT NULL, CONSTRAINT "PK_da95358bb7c50bd57a86e957a86" PRIMARY KEY ("classClassId", "gradeId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_70b945b4098efe8b24112a4a7b" ON "class_grades_grade" ("classClassId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_02aaae111369b8d399a0c40cf7" ON "class_grades_grade" ("gradeId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "class_subjects_subject" ("classClassId" uuid NOT NULL, "subjectId" uuid NOT NULL, CONSTRAINT "PK_38f031e950c10d63bf7bdbef423" PRIMARY KEY ("classClassId", "subjectId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_657918555e113a46de0e2932c1" ON "class_subjects_subject" ("classClassId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_1dcd296a909d0bcc15d86bec5f" ON "class_subjects_subject" ("subjectId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "user_classes_teaching_class" ("userUserId" uuid NOT NULL, "classClassId" uuid NOT NULL, CONSTRAINT "PK_51286e4c55d45731f544a75caa9" PRIMARY KEY ("userUserId", "classClassId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_2e838cbe8e1ea1529e44545758" ON "user_classes_teaching_class" ("userUserId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_e885f53dfa5c2d93ce87227c2f" ON "user_classes_teaching_class" ("classClassId") `
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "user_classes_studying_class" ("userUserId" uuid NOT NULL, "classClassId" uuid NOT NULL, CONSTRAINT "PK_fa86db3cd04029d2cc4a08c9ce2" PRIMARY KEY ("userUserId", "classClassId"))`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_e5af799b7d51ace3516f741fba" ON "user_classes_studying_class" ("userUserId") `
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_ab989978713e6b069ffaebc3e5" ON "user_classes_studying_class" ("classClassId") `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_e6757f9fe2318591744b44224e8') THEN
                    ALTER TABLE "grade" ADD CONSTRAINT "FK_e6757f9fe2318591744b44224e8" FOREIGN KEY ("progress_from_grade_id") REFERENCES "grade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_132391d477a6df3fa86d3ecbe73') THEN
                    ALTER TABLE "grade" ADD CONSTRAINT "FK_132391d477a6df3fa86d3ecbe73" FOREIGN KEY ("progress_to_grade_id") REFERENCES "grade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_266262b4fb70bc21d0609ab41f8') THEN
                    ALTER TABLE "grade" ADD CONSTRAINT "FK_266262b4fb70bc21d0609ab41f8" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_aeb6fd04b2c209ace73f04d6428') THEN
                    ALTER TABLE "role" ADD CONSTRAINT "FK_aeb6fd04b2c209ace73f04d6428" FOREIGN KEY ("organizationOrganizationId") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f0984fa1b551651e47170ff21b3') THEN
                    ALTER TABLE "school_membership" ADD CONSTRAINT "FK_f0984fa1b551651e47170ff21b3" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_eed5395da4e121b5e0d9b06bb01') THEN
                    ALTER TABLE "school_membership" ADD CONSTRAINT "FK_eed5395da4e121b5e0d9b06bb01" FOREIGN KEY ("schoolSchoolId") REFERENCES "school"("school_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_1dfd6df5b40adc5e8783fb3ffc9') THEN
                    ALTER TABLE "subcategory" ADD CONSTRAINT "FK_1dfd6df5b40adc5e8783fb3ffc9" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d5594fcb9d4210bcad13098173a') THEN
                    ALTER TABLE "category" ADD CONSTRAINT "FK_d5594fcb9d4210bcad13098173a" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_03606bedc87e4c41f2c3e58ae22') THEN
                    ALTER TABLE "subject" ADD CONSTRAINT "FK_03606bedc87e4c41f2c3e58ae22" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_2ff4063d818db1c3d9021431636') THEN
                    ALTER TABLE "program" ADD CONSTRAINT "FK_2ff4063d818db1c3d9021431636" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fc66ca5ea58b906c3d8757c7c08') THEN
                    ALTER TABLE "school" ADD CONSTRAINT "FK_fc66ca5ea58b906c3d8757c7c08" FOREIGN KEY ("organizationOrganizationId") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f8ff2ae8e51e3880520d984e81f') THEN
                    ALTER TABLE "class" ADD CONSTRAINT "FK_f8ff2ae8e51e3880520d984e81f" FOREIGN KEY ("organizationOrganizationId") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_af092fb11378f417fa5c47f3671') THEN
                    ALTER TABLE "organization_ownership" ADD CONSTRAINT "FK_af092fb11378f417fa5c47f3671" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f6a339c08dd0262ce0639091b75') THEN
                    ALTER TABLE "organization_ownership" ADD CONSTRAINT "FK_f6a339c08dd0262ce0639091b75" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_2af3e757ddd2c6ae0598b094b0b') THEN
                    ALTER TABLE "user" ADD CONSTRAINT "FK_2af3e757ddd2c6ae0598b094b0b" FOREIGN KEY ("myOrganizationOrganizationId") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fecc54a367461fb4fdddcb452ce') THEN
                    ALTER TABLE "organization_membership" ADD CONSTRAINT "FK_fecc54a367461fb4fdddcb452ce" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_0577a4312cdcded9c8bd906365f') THEN
                    ALTER TABLE "organization_membership" ADD CONSTRAINT "FK_0577a4312cdcded9c8bd906365f" FOREIGN KEY ("organizationOrganizationId") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_30cc1cf9f61819c8b229e2ac51f') THEN
                    ALTER TABLE "branding_image" ADD CONSTRAINT "FK_30cc1cf9f61819c8b229e2ac51f" FOREIGN KEY ("branding_id") REFERENCES "branding"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_76c80b06b6946bc95459a01918c') THEN
                    ALTER TABLE "branding" ADD CONSTRAINT "FK_76c80b06b6946bc95459a01918c" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f9e1430871bf8b1ca42af4072a6') THEN
                    ALTER TABLE "organization" ADD CONSTRAINT "FK_f9e1430871bf8b1ca42af4072a6" FOREIGN KEY ("primaryContactUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f03452017bb25d2e5481b1c1012') THEN
                    ALTER TABLE "age_range" ADD CONSTRAINT "FK_f03452017bb25d2e5481b1c1012" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_239d4448a254314c575ebee4b16') THEN
                    ALTER TABLE "permission_roles_role" ADD CONSTRAINT "FK_239d4448a254314c575ebee4b16" FOREIGN KEY ("permissionPermissionId") REFERENCES "permission"("permission_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ead8ac61d0fb420cde0ff36c82e') THEN
                    ALTER TABLE "permission_roles_role" ADD CONSTRAINT "FK_ead8ac61d0fb420cde0ff36c82e" FOREIGN KEY ("roleRoleId") REFERENCES "role"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d64a77ccb60c7223cdb7503af2a') THEN
                    ALTER TABLE "role_memberships_organization_membership" ADD CONSTRAINT "FK_d64a77ccb60c7223cdb7503af2a" FOREIGN KEY ("roleRoleId") REFERENCES "role"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_6bb7ea4e331c11a6a821e383b00') THEN
                    ALTER TABLE "role_memberships_organization_membership" ADD CONSTRAINT "FK_6bb7ea4e331c11a6a821e383b00" FOREIGN KEY ("organizationMembershipUserId", "organizationMembershipOrganizationId") REFERENCES "organization_membership"("user_id","organization_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_717cd0804a1388fa0efd1969036') THEN
                    ALTER TABLE "role_school_memberships_school_membership" ADD CONSTRAINT "FK_717cd0804a1388fa0efd1969036" FOREIGN KEY ("roleRoleId") REFERENCES "role"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d7559cc316aba6912fed713ea90') THEN
                    ALTER TABLE "role_school_memberships_school_membership" ADD CONSTRAINT "FK_d7559cc316aba6912fed713ea90" FOREIGN KEY ("schoolMembershipUserId", "schoolMembershipSchoolId") REFERENCES "school_membership"("user_id","school_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_24e438cea0fd95cb8f2e33ea118') THEN
                    ALTER TABLE "category_subcategories_subcategory" ADD CONSTRAINT "FK_24e438cea0fd95cb8f2e33ea118" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_85f1569ff88406212e23f628dbf') THEN
                    ALTER TABLE "category_subcategories_subcategory" ADD CONSTRAINT "FK_85f1569ff88406212e23f628dbf" FOREIGN KEY ("subcategoryId") REFERENCES "subcategory"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_95dd6c21c5a4818ccbd55499794') THEN
                    ALTER TABLE "subject_categories_category" ADD CONSTRAINT "FK_95dd6c21c5a4818ccbd55499794" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_62e7f20e2c55a247829318c756b') THEN
                    ALTER TABLE "subject_categories_category" ADD CONSTRAINT "FK_62e7f20e2c55a247829318c756b" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_3d4870570803ada96985442de1a') THEN
                    ALTER TABLE "program_age_ranges_age_range" ADD CONSTRAINT "FK_3d4870570803ada96985442de1a" FOREIGN KEY ("programId") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d1ccc2d2e2f6e8632e60bd2f72d') THEN
                    ALTER TABLE "program_age_ranges_age_range" ADD CONSTRAINT "FK_d1ccc2d2e2f6e8632e60bd2f72d" FOREIGN KEY ("ageRangeId") REFERENCES "age_range"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_be11f6d4e92b35e388d77a58906') THEN
                    ALTER TABLE "program_grades_grade" ADD CONSTRAINT "FK_be11f6d4e92b35e388d77a58906" FOREIGN KEY ("programId") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_80d7479d3b77c2b1269bd91bb56') THEN
                    ALTER TABLE "program_grades_grade" ADD CONSTRAINT "FK_80d7479d3b77c2b1269bd91bb56" FOREIGN KEY ("gradeId") REFERENCES "grade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_be85e983b2d960972cf859013d7') THEN
                    ALTER TABLE "program_subjects_subject" ADD CONSTRAINT "FK_be85e983b2d960972cf859013d7" FOREIGN KEY ("programId") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_051e21c8a1d95f59de130a110e1') THEN
                    ALTER TABLE "program_subjects_subject" ADD CONSTRAINT "FK_051e21c8a1d95f59de130a110e1" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_9f897b46976c7c9183231d517b9') THEN
                    ALTER TABLE "school_classes_class" ADD CONSTRAINT "FK_9f897b46976c7c9183231d517b9" FOREIGN KEY ("schoolSchoolId") REFERENCES "school"("school_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_444600a32c9885b46939d304c17') THEN
                    ALTER TABLE "school_classes_class" ADD CONSTRAINT "FK_444600a32c9885b46939d304c17" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_6d02461da423605ef9ccc3512bd') THEN
                    ALTER TABLE "school_programs_program" ADD CONSTRAINT "FK_6d02461da423605ef9ccc3512bd" FOREIGN KEY ("schoolSchoolId") REFERENCES "school"("school_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_a58b3085a8ec33fdeb2162d80a8') THEN
                    ALTER TABLE "school_programs_program" ADD CONSTRAINT "FK_a58b3085a8ec33fdeb2162d80a8" FOREIGN KEY ("programId") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_6e6cf742a4c6845df0a2f866ade') THEN
                    ALTER TABLE "class_programs_program" ADD CONSTRAINT "FK_6e6cf742a4c6845df0a2f866ade" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f4bcd89eaf5f669193ac33c160c') THEN
                    ALTER TABLE "class_programs_program" ADD CONSTRAINT "FK_f4bcd89eaf5f669193ac33c160c" FOREIGN KEY ("programId") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_6d31d313b7d9507824f0686a8eb') THEN
                    ALTER TABLE "class_age_ranges_age_range" ADD CONSTRAINT "FK_6d31d313b7d9507824f0686a8eb" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_aebc225830a42f04f6eb63f378a') THEN
                    ALTER TABLE "class_age_ranges_age_range" ADD CONSTRAINT "FK_aebc225830a42f04f6eb63f378a" FOREIGN KEY ("ageRangeId") REFERENCES "age_range"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_70b945b4098efe8b24112a4a7bf') THEN
                    ALTER TABLE "class_grades_grade" ADD CONSTRAINT "FK_70b945b4098efe8b24112a4a7bf" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_02aaae111369b8d399a0c40cf7f') THEN
                    ALTER TABLE "class_grades_grade" ADD CONSTRAINT "FK_02aaae111369b8d399a0c40cf7f" FOREIGN KEY ("gradeId") REFERENCES "grade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_657918555e113a46de0e2932c14') THEN
                    ALTER TABLE "class_subjects_subject" ADD CONSTRAINT "FK_657918555e113a46de0e2932c14" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_1dcd296a909d0bcc15d86bec5fa') THEN
                    ALTER TABLE "class_subjects_subject" ADD CONSTRAINT "FK_1dcd296a909d0bcc15d86bec5fa" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_2e838cbe8e1ea1529e44545758f') THEN
                    ALTER TABLE "user_classes_teaching_class" ADD CONSTRAINT "FK_2e838cbe8e1ea1529e44545758f" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_e885f53dfa5c2d93ce87227c2fa') THEN
                    ALTER TABLE "user_classes_teaching_class" ADD CONSTRAINT "FK_e885f53dfa5c2d93ce87227c2fa" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_e5af799b7d51ace3516f741fba3') THEN
                    ALTER TABLE "user_classes_studying_class" ADD CONSTRAINT "FK_e5af799b7d51ace3516f741fba3" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ab989978713e6b069ffaebc3e54') THEN
                    ALTER TABLE "user_classes_studying_class" ADD CONSTRAINT "FK_ab989978713e6b069ffaebc3e54" FOREIGN KEY ("classClassId") REFERENCES "class"("class_id") ON DELETE CASCADE ON UPDATE NO ACTION;                    
                END IF;
            END$$;
            `
        )

        console.log('Successfully ran the initial state database migration.')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
