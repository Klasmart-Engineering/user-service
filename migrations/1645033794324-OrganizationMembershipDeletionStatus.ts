import { MigrationInterface, QueryRunner } from 'typeorm'

export class OrganizationMembershipDeletionStatus1645033794324
    implements MigrationInterface {
    name = 'OrganizationMembershipDeletionStatus1645033794324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            DO $$
            BEGIN
                ALTER TYPE organization_membership_status_enum ADD VALUE IF NOT EXISTS 'deleted' AFTER 'inactive';
            END$$;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // you can't remove enum values, you have to create a new type
        // it would also require a data migration of the remove value
    }
}
