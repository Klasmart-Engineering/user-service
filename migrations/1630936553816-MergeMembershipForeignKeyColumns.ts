import { MigrationInterface, QueryRunner } from 'typeorm'

export class MergeMembershipForeignKeyColumns1630936553816
    implements MigrationInterface {
    name = 'MergeMembershipForeignKeyColumns1630936553816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP CONSTRAINT "FK_eed5395da4e121b5e0d9b06bb01"`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP CONSTRAINT "FK_f0984fa1b551651e47170ff21b3"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP CONSTRAINT "FK_fecc54a367461fb4fdddcb452ce"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP CONSTRAINT "FK_0577a4312cdcded9c8bd906365f"`
        )
        await queryRunner.query(
            `ALTER TABLE "role_school_memberships_school_membership" DROP CONSTRAINT "FK_d7559cc316aba6912fed713ea90"`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP CONSTRAINT "PK_8460e14e1fbe5cea7ec60a282dc"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP CONSTRAINT "PK_4c0dd6adaf8fc161026db004550"`
        )
        await queryRunner.query(
            `ALTER TABLE "role_memberships_organization_membership" DROP CONSTRAINT "FK_6bb7ea4e331c11a6a821e383b00"`
        )
        await queryRunner.query(`DROP INDEX "IDX_6bb7ea4e331c11a6a821e383b0"`)
        await queryRunner.query(
            `ALTER TABLE "role_memberships_organization_membership" DROP CONSTRAINT "PK_2fd508e51b02927a5d0de7669fd"`
        )
        await queryRunner.query(`DROP INDEX "IDX_d7559cc316aba6912fed713ea9"`)

        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP COLUMN "userUserId"`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" DROP COLUMN "schoolSchoolId"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP COLUMN "userUserId"`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" DROP COLUMN "organizationOrganizationId"`
        )

        await queryRunner.query(
            `ALTER TABLE "school_membership" ALTER COLUMN "user_id" TYPE uuid USING user_id::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ALTER COLUMN "school_id" TYPE uuid USING school_id::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ADD CONSTRAINT "PK_8460e14e1fbe5cea7ec60a282dc" PRIMARY KEY ("user_id", "school_id")`
        )

        await queryRunner.query(
            `ALTER TABLE "organization_membership" ALTER COLUMN "user_id" TYPE uuid USING user_id::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ALTER COLUMN "organization_id" TYPE uuid USING organization_id::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ADD CONSTRAINT "PK_4c0dd6adaf8fc161026db004550" PRIMARY KEY ("user_id", "organization_id")`
        )
        await queryRunner.query(
            `ALTER TABLE "role_memberships_organization_membership" ALTER COLUMN "organizationMembershipUserId" TYPE uuid USING organizationMembershipUserId::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "role_memberships_organization_membership" ALTER COLUMN "organizationMembershipOrganizationId" TYPE uuid USING organizationMembershipOrganizationId::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "role_memberships_organization_membership" ADD CONSTRAINT "PK_2fd508e51b02927a5d0de7669fd" PRIMARY KEY ("roleRoleId", "organizationMembershipUserId", "organizationMembershipOrganizationId")`
        )
        await queryRunner.query(
            `ALTER TABLE "role_school_memberships_school_membership" ALTER COLUMN "schoolMembershipUserId" TYPE uuid USING schoolMembershipUserId::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "role_school_memberships_school_membership" ALTER COLUMN "schoolMembershipSchoolId" TYPE uuid USING schoolMembershipSchoolId::uuid`
        )
        await queryRunner.query(
            `ALTER TABLE "role_school_memberships_school_membership" ADD CONSTRAINT "PK_1c14964d630a9d9e274b3a78916" PRIMARY KEY ("roleRoleId", "schoolMembershipUserId", "schoolMembershipSchoolId")`
        )

        await queryRunner.query(
            `CREATE INDEX "IDX_6bb7ea4e331c11a6a821e383b0" ON "role_memberships_organization_membership" ("organizationMembershipUserId", "organizationMembershipOrganizationId") `
        )
        await queryRunner.query(
            `CREATE INDEX "IDX_d7559cc316aba6912fed713ea9" ON "role_school_memberships_school_membership" ("schoolMembershipUserId", "schoolMembershipSchoolId") `
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ADD CONSTRAINT "FK_0c54a9d111ed8d6acfe9914d701" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        )
        await queryRunner.query(
            `ALTER TABLE "school_membership" ADD CONSTRAINT "FK_329d206995c6c8a807b629254f3" FOREIGN KEY ("school_id") REFERENCES "school"("school_id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ADD CONSTRAINT "FK_8d5d2e1483a59e6c008e4ef9e28" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        )
        await queryRunner.query(
            `ALTER TABLE "organization_membership" ADD CONSTRAINT "FK_9ca5d2cb892f7d4a8ff6eebd420" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        )
        await queryRunner.query(
            `ALTER TABLE "role_memberships_organization_membership" ADD CONSTRAINT "FK_6bb7ea4e331c11a6a821e383b00" FOREIGN KEY ("organizationMembershipUserId", "organizationMembershipOrganizationId") REFERENCES "organization_membership"("user_id","organization_id") ON DELETE CASCADE ON UPDATE NO ACTION`
        )
        await queryRunner.query(
            `ALTER TABLE "role_school_memberships_school_membership" ADD CONSTRAINT "FK_d7559cc316aba6912fed713ea90" FOREIGN KEY ("schoolMembershipUserId", "schoolMembershipSchoolId") REFERENCES "school_membership"("user_id","school_id") ON DELETE CASCADE ON UPDATE NO ACTION`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Irreversible
    }
}
