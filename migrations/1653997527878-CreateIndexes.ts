import { MigrationInterface, QueryRunner } from 'typeorm'

export const orgMemOrgIdIndex = 'IDX_ORGANZAITON_MEMBERSHIP_ORGANIZATION_ID'
export const schoolMemOrgIdIndex = 'IDX_SCHOOL_MEMBERSHIP_SCHOOL_ID'
export const subcatOrgIdIndex = 'IDX_SUBCATEGORY_ORGANIZATION_ID'

export class CreateIndexes1653997527878 implements MigrationInterface {
    name = 'CreateIndexes1653997527878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX "${orgMemOrgIdIndex}" ON organization_membership("organization_id")`
        )
        await queryRunner.query(
            `CREATE INDEX "${schoolMemOrgIdIndex}" ON school_membership("school_id")`
        )
        await queryRunner.query(
            `CREATE INDEX "${subcatOrgIdIndex}" ON subcategory(organization_id)`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "${orgMemOrgIdIndex}"`)
        await queryRunner.query(`DROP INDEX "${schoolMemOrgIdIndex}"`)
        await queryRunner.query(`DROP INDEX "${subcatOrgIdIndex}"`)
    }
}
