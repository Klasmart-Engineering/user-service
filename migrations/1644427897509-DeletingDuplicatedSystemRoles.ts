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

// Since this migration is just for remove duplications in an specific environment
// we are removing the exact roles that has not the correct permissions
export const rolesToDeleteIds = [
    '23d899cd-862e-4bb6-8e57-761d701bc9fb' /* Organization Admin */,
    'f70038dd-0361-4f19-8d50-5e42997a6280' /* School Admin */,
    'f1a2083a-7f77-4ec8-b64a-def6952bf807' /* Parent */,
    'fd37310d-5ced-4dda-9968-c6cb084a542b' /* Student */,
    '893f28d2-69f1-4dc5-aa37-a04b9a8d90b9' /* Teacher */,
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
                system_role: true,
            },
            order: {
                created_at: 'ASC',
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
        for (const m of memberships) {
            const roles = (await m.roles) || []
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
