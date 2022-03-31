import {
    EntityManager,
    In,
    MigrationInterface,
    Not,
    QueryRunner,
    WhereExpression,
} from 'typeorm'
import { OrganizationMembership } from '../src/entities/organizationMembership'
import { Role } from '../src/entities/role'
import { SchoolMembership } from '../src/entities/schoolMembership'
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
            rolesToPersist.length !== systemRoleNames.length
        ) {
            logger.error(
                `Unexpected number of roles to delete ${rolesToDelete.length} or persist ${rolesToPersist.length}. Aborting the migration.`
            )
            return
        }

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
        for (const roleName in rolesByName) {
            const fromId = rolesByName[roleName].from
            const toId = rolesByName[roleName].to
            if (!fromId || !toId) {
                throw new Error(`Could not find role ID for ${roleName}`) // should never happen
            }
            for (const table of tables) {
                const query = `UPDATE ${table} SET "roleRoleId" = '${toId}' WHERE "roleRoleId" = '${fromId}'`
                logger.info(`Running query: ${query}`)
                await queryRunner.query(query)
            }
        }

        // Once these roles are not in any organization or school membership, they can be removed
        const deleteRoleIds = Array.from(rolesToDelete.values())
            .flat()
            .map((r) => r.role_id)

        await manager.delete(Role, deleteRoleIds)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        logger.warn(
            'This is a data migration for remove duplications. Down the migration would mean create duplications'
        )
    }
}
