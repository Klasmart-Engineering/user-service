import { MigrationInterface, QueryRunner, getRepository } from 'typeorm'
import { Class } from '../src/entities/class'

export class test1625221482213 implements MigrationInterface {
    name = 'test1625221482213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.renameDuplicateShortcodes(queryRunner)

        await queryRunner.query(
            `ALTER TABLE "class" ADD CONSTRAINT "UQ_7dc317c7a189f39e70e85c12845" UNIQUE ("shortcode", "organizationOrganizationId")`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "class" DROP CONSTRAINT "UQ_7dc317c7a189f39e70e85c12845"`
        )
    }

    public async renameDuplicateShortcodes(queryRunner: QueryRunner) {
        const duplicateShortcodes = (await getRepository(Class)
            .createQueryBuilder()
            .select(['shortcode', '"Class"."organizationOrganizationId"'])
            .groupBy('shortcode, "Class"."organizationOrganizationId"')
            .having('count(*) > 1')
            .getRawMany()) as Record<string, string>[]

        for (const dupe of duplicateShortcodes) {
            if (dupe.organizationOrganizationId) {
                queryRunner.query(
                    `
            UPDATE class SET shortcode = upper(substring(md5(random()::text), 0, 10)) 
              where "class"."organizationOrganizationId" = '${dupe.organizationOrganizationId}' and shortcode = '${dupe.shortcode}'`
                )
            }
        }
    }
}
