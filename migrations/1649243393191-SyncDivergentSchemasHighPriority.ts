import { MigrationInterface, QueryRunner } from 'typeorm'

// More details about this mutation here: https://calmisland.atlassian.net/l/c/jDYfDjkh
export class SyncDivergentSchemasHighPriority1649243393191
    implements MigrationInterface {
    name = 'SyncDivergentSchemasHighPriority1649243393191'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Syncing up constraints
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'REL_2af3e757ddd2c6ae0598b094b0') THEN
                    ALTER TABLE ONLY "user" 
                    ADD CONSTRAINT "REL_2af3e757ddd2c6ae0598b094b0" 
                    UNIQUE ("myOrganizationOrganizationId");
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_76c80b06b6946bc95459a01918c') THEN
                    ALTER TABLE ONLY "branding" 
                    ADD CONSTRAINT "FK_76c80b06b6946bc95459a01918c" 
                    FOREIGN KEY (organization_id) REFERENCES organization(organization_id);
                END IF;
            END$$;
            `
        )
        await queryRunner.query(
            `ALTER TABLE ONLY "user" DROP CONSTRAINT IF EXISTS "UQ_2af3e757ddd2c6ae0598b094b0b" CASCADE;`
        ) // UNIQUE ("myOrganizationOrganizationId") on "user" table
        await queryRunner.query(
            `ALTER TABLE ONLY "school" DROP CONSTRAINT IF EXISTS "UQ_d8c1edf6c7d4bf82e0dd8b2f35e" CASCADE;`
        ) // UNIQUE (school_name, "organizationOrganizationId") on "school" table
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Does not make sense to undo these changes since they are not uniform across all environments
        // For example if table A is in environment alpha, but not in prod-uk and we want to remove it from alpha
        // then in 'up' we would have 'DROP TABLE IF EXISTS...'
    }
}
