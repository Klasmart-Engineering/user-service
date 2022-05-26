import { MigrationInterface, QueryRunner } from 'typeorm'

// More details about this mutation here: https://calmisland.atlassian.net/l/c/jDYfDjkh
export class SyncDivergentSchemasLowPriority1649264010246
    implements MigrationInterface {
    name = 'SyncDivergentSchemasLowPriority1649264010246'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Surplus indices (only found on dev-alpha)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_age_range" CASCADE;`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_grade" CASCADE;`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_program" CASCADE;`)
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_subcategory" CASCADE;`
        )
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_subject" CASCADE;`)

        // Deprecated features of user-service
        await queryRunner.query(
            `DROP TABLE IF EXISTS "user_metrics_query_count" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "user_metrics_query_variables" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "subject_subcategories_subcategory" CASCADE;`
        )
        await queryRunner.query(`DROP TABLE IF EXISTS "attendance" CASCADE;`)
        await queryRunner.query(
            `DROP TYPE IF EXISTS "attendance_status_enum" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "backup_attendance" CASCADE;`
        )

        // Leftover artifacts from other services
        await queryRunner.query(`DROP TABLE IF EXISTS "keep_orgs" CASCADE;`)
        await queryRunner.query(`DROP TABLE IF EXISTS "rooms" CASCADE;`)
        await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`)
        await queryRunner.query(
            `DROP TABLE IF EXISTS "assessment_xapi_answer" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "assessment_xapi_answer_user_id_seq" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "assessment_xapi_migration" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "assessment_xapi_migration_user_id_seq" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "assessment_xapi_room" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "assessment_xapi_room_user_id_seq" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "assessment_xapi_teacher_comment" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "assessment_xapi_teacher_comment_user_id_seq" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "assessment_xapi_teacher_score" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "assessment_xapi_teacher_score_user_id_seq" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "assessment_xapi_user_content_score" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "assessment_xapi_user_content_score_user_id_seq" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "backup_assessment_xapi_room" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "bk_assessment_xapi_answer" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "bk_assessment_xapi_teacher_comment" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "bk_assessment_xapi_teacher_score" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "bk_assessment_xapi_user_content_score" CASCADE;`
        )
        await queryRunner.query(`DROP TABLE IF EXISTS "bk_feedback" CASCADE;`)
        await queryRunner.query(
            `DROP TABLE IF EXISTS "bk_quick_feedback" CASCADE;`
        )

        await queryRunner.query(`DROP TABLE IF EXISTS "feedback" CASCADE;`)
        await queryRunner.query(
            `DROP TYPE IF EXISTS "feedback_type_enum" CASCADE;`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS "quick_feedback" CASCADE;`
        )
        await queryRunner.query(
            `DROP TYPE IF EXISTS "quickfeedback_type_enum" CASCADE;`
        )
        await queryRunner.query(
            `DROP SEQUENCE IF EXISTS "quick_feedback_id_seq" CASCADE;`
        )
        await queryRunner.query(`DROP TABLE IF EXISTS "pdf_metadata" CASCADE;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Does not make sense to undo these changes since they are not uniform across all environments
        // For example if table A is in environment alpha, but not in prod-uk and we want to remove it from alpha
        // then in 'up' we would have 'DROP TABLE IF EXISTS...'
    }
}
