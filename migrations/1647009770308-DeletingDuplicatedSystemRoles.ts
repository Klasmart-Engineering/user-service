import { In, MigrationInterface, Not, QueryRunner } from 'typeorm'
import { Role } from '../src/entities/role'
import logger from '../src/logging'
import { organizationAdminRole } from '../src/permissions/organizationAdmin'
import { parentRole } from '../src/permissions/parent'
import { schoolAdminRole } from '../src/permissions/schoolAdmin'
import { studentRole } from '../src/permissions/student'
import { teacherRole } from '../src/permissions/teacher'

// Since this migration is just for remove duplications in an specific environment
// we are removing the exact roles that does not match with the rest of environments
export const rolesToDeleteIds = [
    '9e76e8dc-33b9-45af-a446-2d1b71b65bd6' /* Organization Admin */,
    '3230d93b-c904-41b6-8124-db8b34eaf6fd' /* School Admin */,
    '4d2f692c-4af0-4c62-bc69-3456f4194b13' /* Teacher */,
    '62e3c6aa-c65c-4638-a543-164a1258e740' /* Parent */,
    '56d95fe5-491b-4568-b453-df4d255c19f3' /* Student */,
]

const systemRoleNames = [
    organizationAdminRole.role_name,
    schoolAdminRole.role_name,
    teacherRole.role_name,
    parentRole.role_name,
    studentRole.role_name,
]

export class DeletingDuplicatedSystemRoles1647009770308
    implements MigrationInterface {
    name = 'DeletingDuplicatedSystemRoles1647009770308'

    public async up(queryRunner: QueryRunner): Promise<void> {
        logger.info(
            'Running up migration: DeletingDuplicatedSystemRoles1647009770308'
        )
        const manager = queryRunner.manager
        const rolesToDelete = await manager.find(Role, {
            where: {
                role_id: In(rolesToDeleteIds),
                role_name: In(systemRoleNames),
                system_role: true,
            },
        })
        if (!rolesToDelete.length) {
            logger.info('No roles to delete, aborting the migration.')
            return
        }

        const rolesToPersist = await manager.find(Role, {
            where: {
                role_id: Not(In(rolesToDeleteIds)),
                role_name: In(systemRoleNames),
                system_role: true,
            },
        })

        if (
            rolesToDelete.length !== rolesToDeleteIds.length ||
            rolesToPersist.length !== rolesToDelete.length
        ) {
            logger.error(
                `Unexpected number of roles to delete ${rolesToDelete.length} or persist ${rolesToPersist.length}. Aborting the migration.`
            )
            return
        }

        // first remove any memberships with both the original and dupe roles
        // to avoid violating the unique constraint on the role_id+userId+organizationId/schoolId
        await this.deleteDupeMembershipRoles(rolesToDelete, queryRunner)

        // map role by name to from & to ID
        const rolesByName: {
            [name: string]: { from?: string; to?: string }
        } = {}

        for (const roleName of systemRoleNames) {
            rolesByName[roleName] = {
                from: rolesToDelete.find((r) => r.role_name === roleName)
                    ?.role_id,
                to: rolesToPersist.find((r) => r.role_name === roleName)
                    ?.role_id,
            }
        }

        const tables = [
            'role_memberships_organization_membership',
            'role_school_memberships_school_membership',
        ]

        // migrate memberships for each role one by one
        logger.info('Updating membership tables.')

        for (const roleName in rolesByName) {
            const fromId = rolesByName[roleName].from
            const toId = rolesByName[roleName].to
            if (!fromId || !toId) {
                throw new Error(`Could not find role ID for ${roleName}`) // should never happen
            }
            for (const table of tables) {
                const query = `UPDATE ${table} SET "roleRoleId" = '${toId}' WHERE "roleRoleId" = '${fromId}'`
                logger.info(`Running query: ${query}`)
                // eslint-disable-next-line no-await-in-loop
                await queryRunner.query(query)
            }
        }

        // Once these roles are not in any organization or school membership, they can be hard deleted
        await manager.delete(Role, rolesToDeleteIds)

        logger.info(
            'DeletingDuplicatedSystemRoles1647009770308 ran successfully.'
        )
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        logger.warn(
            'Skipping DeletingDuplicatedSystemRoles1647009770308 down migration - not applicable.'
        )
    }

    // deletes the dupe role for users that have a membership with both the original and dupe role
    private async deleteDupeMembershipRoles(
        rolesToDelete: Role[],
        queryRunner: QueryRunner
    ) {
        for (const role of rolesToDelete) {
            const orgQuery = `
                delete from "role_memberships_organization_membership" 

                where "role_memberships_organization_membership"."roleRoleId" = '${role.role_id}'
                
                and "role_memberships_organization_membership"."organizationMembershipUserId" in (
                    select "role_memberships_organization_membership"."organizationMembershipUserId" from role_memberships_organization_membership
                        inner join role on "role"."role_id" = "role_memberships_organization_membership"."roleRoleId"
                        group by "role_memberships_organization_membership"."organizationMembershipUserId", "role_memberships_organization_membership"."organizationMembershipOrganizationId","role"."role_name"
                    having count(*) > 1
                    and "role"."role_name" = '${role.role_name}'
                )
            `

            const schoolQuery = `
                delete from "role_school_memberships_school_membership" 

                where "role_school_memberships_school_membership"."roleRoleId" = '${role.role_id}'
                
                and "role_school_memberships_school_membership"."schoolMembershipUserId" in (
                    select "role_school_memberships_school_membership"."schoolMembershipUserId" from role_memberships_organization_membership
                        inner join role on "role"."role_id" = "role_school_memberships_school_membership"."roleRoleId"
                        group by "role_school_memberships_school_membership"."schoolMembershipUserId", "role_school_memberships_school_membership"."schoolMembershipSchoolId","role"."role_name"
                    having count(*) > 1
                    and "role"."role_name" = '${role.role_name}'
                )
            `

            // eslint-disable-next-line no-await-in-loop
            await queryRunner.query(orgQuery)
            // eslint-disable-next-line no-await-in-loop
            await queryRunner.query(schoolQuery)
        }
    }
}
