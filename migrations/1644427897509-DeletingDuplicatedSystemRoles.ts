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

export class DeletingDuplicatedSystemRoles1644427897509
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const manager = queryRunner.manager
        // Searching for the roles that will be deleted
        const rolesToDelete = await this.getRolesMapByIds(
            manager,
            'in',
            rolesToDeleteIds,
            'role_id'
        )

        // Searching for the roles that will replace the deleted ones
        const rolesToPersist = await this.getRolesMapByIds(
            manager,
            'not-in',
            rolesToDeleteIds,
            'role_name'
        )

        if (
            rolesToDelete.size === rolesToDeleteIds.length &&
            rolesToPersist.size === rolesToDeleteIds.length
        ) {
            // Getting the memberships involved in roles to delete
            const {
                orgMemberships,
                schoolMemberships,
            } = await this.getMembershipsToMigrate(manager)

            // Migrating roles to be removed to the persisting ones in the org memberships involved
            await this.migrateMemberships(
                manager,
                orgMemberships,
                rolesToDelete,
                rolesToPersist
            )

            // Migrating roles to be removed to the persisting ones in the school memberships involved
            await this.migrateMemberships(
                manager,
                schoolMemberships,
                rolesToDelete,
                rolesToPersist
            )

            // Once these roles are not in any organization or school membership, they can be removed
            const deleteRoleIds = Array.from(rolesToDelete.values())
                .flat()
                .map((r) => r.role_id)

            await manager.delete(Role, deleteRoleIds)
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        logger.warn(
            'This is a data migration for remove duplications. Down the migration would mean create duplications'
        )
    }

    private async getRolesMapByIds(
        manager: EntityManager,
        operator: 'in' | 'not-in',
        ids: string[],
        key: 'role_id' | 'role_name'
    ) {
        const preloadedRolesToDelete = manager.find(Role, {
            where: {
                role_id: operator === 'in' ? In(ids) : Not(In(ids)),
                role_name: In(systemRoleNames),
                system_role: true,
            },
        })

        return new Map<string, Role>(
            (await preloadedRolesToDelete).map((r) => [r[key]!, r])
        )
    }

    private async getMembershipsToMigrate(manager: EntityManager) {
        const orgMemberships = await manager.find(OrganizationMembership, {
            join: {
                alias: 'OrgMembership',
                innerJoin: {
                    roles: 'OrgMembership.roles',
                },
            },
            where: (qb: WhereExpression) => {
                qb.where('roles.role_id IN (:...roleIds)', {
                    roleIds: rolesToDeleteIds,
                })
            },
        })

        const schoolMemberships = await manager.find(SchoolMembership, {
            join: {
                alias: 'SchoolMembership',
                innerJoin: {
                    roles: 'SchoolMembership.roles',
                },
            },
            where: (qb: WhereExpression) => {
                qb.where('roles.role_id IN (:...roleIds)', {
                    roleIds: rolesToDeleteIds,
                })
            },
        })

        return {
            orgMemberships,
            schoolMemberships,
        }
    }

    private async migrateMemberships(
        manager: EntityManager,
        memberships: OrganizationMembership[] | SchoolMembership[],
        rolesToDelete: Map<string, Role>,
        rolesToPersist: Map<string, Role>
    ) {
        const allRoles = await Promise.all(memberships.map(m => m.roles))

        for (const [i, m] of memberships.entries()) {
            const roles = allRoles[i] || []
            const newRoles: Role[] = []

            for (const r of roles) {
                let roleToPush = r
                if (r.role_name) {
                    const roleToDelete = rolesToDelete.get(r.role_id)

                    if (roleToDelete) {
                        const roleToReplace = rolesToPersist.get(
                            roleToDelete.role_name!
                        )!

                        roleToPush = roleToReplace
                    }
                }

                newRoles.push(roleToPush)
            }

            m.roles = Promise.resolve(newRoles)
        }

        await manager.save(memberships)
    }
}
