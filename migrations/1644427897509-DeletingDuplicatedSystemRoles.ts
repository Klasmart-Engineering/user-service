import {
    EntityManager,
    In,
    MigrationInterface,
    QueryRunner,
    WhereExpression,
} from 'typeorm'
import { OrganizationMembership } from '../src/entities/organizationMembership'
import { Role } from '../src/entities/role'
import { SchoolMembership } from '../src/entities/schoolMembership'
import { organizationAdminRole } from '../src/permissions/organizationAdmin'
import { parentRole } from '../src/permissions/parent'
import { schoolAdminRole } from '../src/permissions/schoolAdmin'
import { studentRole } from '../src/permissions/student'
import { teacherRole } from '../src/permissions/teacher'

export class DeletingDuplicatedSystemRoles1644427897509
    implements MigrationInterface {
    private systemRolesData = [
        organizationAdminRole,
        schoolAdminRole,
        parentRole,
        studentRole,
        teacherRole,
    ]

    public async up(queryRunner: QueryRunner): Promise<void> {
        const manager = queryRunner.manager
        const systemRoleNames = this.systemRolesData.map((r) => r.role_name)
        const systemRoles = await manager.find(Role, {
            where: {
                role_name: In(systemRoleNames),
                system_role: true,
            },
            order: {
                created_at: 'ASC',
            },
        })

        if (systemRoles.length > systemRoleNames.length) {
            const {
                rolesToDelete,
                rolesToPersist,
                orgMemberships,
                schoolMemberships,
            } = await this.buildMaps(manager, systemRoles)

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
        throw new Error(
            'This is a data migration for remove duplications. Down the migration would mean create duplications'
        )
    }

    private async buildMaps(manager: EntityManager, systemRoles: Role[]) {
        const rolesToDelete = new Map<string, Role[]>()
        const rolesToPersist = new Map<string, Role>()

        systemRoles.forEach((r) => {
            const roleName = r.role_name!

            if (rolesToPersist.has(roleName)) {
                if (rolesToDelete.has(roleName)) {
                    rolesToDelete.get(roleName)?.push(r)
                } else {
                    rolesToDelete.set(roleName, [r])
                }
            } else {
                rolesToPersist.set(roleName, r)
            }
        })

        const rolesToDeleteIds = Array.from(rolesToDelete.values())
            .map((roles) => roles.map((r) => r.role_id))
            .flat()

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
            rolesToDelete,
            rolesToPersist,
            orgMemberships,
            schoolMemberships,
        }
    }

    private async migrateMemberships(
        manager: EntityManager,
        memberships: OrganizationMembership[] | SchoolMembership[],
        rolesToDelete: Map<string, Role[]>,
        rolesToPersist: Map<string, Role>
    ) {
        for (const m of memberships) {
            const roles = (await m.roles) || []
            const newRoles: Role[] = []

            for (const r of roles) {
                let roleToPush = r
                if (r.role_name) {
                    const roleToDelete = rolesToDelete.get(r.role_name)

                    if (roleToDelete) {
                        const roleToReplace = rolesToPersist.get(r.role_name)!
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
