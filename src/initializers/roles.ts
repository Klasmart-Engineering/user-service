import { EntityManager, getManager, In, WhereExpression } from 'typeorm'

import { Permission } from '../entities/permission'
import { organizationAdminRole } from '../permissions/organizationAdmin'
import { parentRole } from '../permissions/parent'
import { permissionInfo } from '../permissions/permissionInfo'
import { PermissionName } from '../permissions/permissionNames'
import { Role } from '../entities/role'
import { schoolAdminRole } from '../permissions/schoolAdmin'
import { studentRole } from '../permissions/student'
import { teacherRole } from '../permissions/teacher'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Status } from '../entities/status'
import { SchoolMembership } from '../entities/schoolMembership'

export class RolesInitializer {
    private systemRolesData = [
        organizationAdminRole,
        schoolAdminRole,
        parentRole,
        studentRole,
        teacherRole,
    ]

    public async run() {
        const roles = new Map<string, Role>()

        await this._removeDuplicatedSystemRoles()

        await this.createSystemPermissions()

        await getManager().transaction(async (manager) => {
            await this._createDefaultRoles(manager, roles)
        })

        return roles.values()
    }

    private async createSystemPermissions() {
        await this._createSystemPermissions()
        await this._inactivateInvalidExistingPermissions()
    }

    private async _createSystemPermissions() {
        const permissionDetails = await permissionInfo()
        const permissionAttributes = []

        for (const permission_name of Object.values(PermissionName)) {
            const permissionInf = permissionDetails.get(permission_name)

            permissionAttributes.push({
                permission_name: permission_name,
                permission_id: permission_name,
                permission_category: permissionInf?.category,
                permission_level: permissionInf?.level,
                permission_group: permissionInf?.group,
                permission_description: permissionInf?.description,
                allow: true,
            })
        }

        await Permission.createQueryBuilder()
            .insert()
            .into(Permission)
            .values(permissionAttributes)
            .orUpdate({
                conflict_target: ['permission_id'],
                overwrite: [
                    'permission_name',
                    'permission_category',
                    'permission_level',
                    'permission_group',
                    'permission_description',
                    'allow',
                ],
            })
            .execute()
    }

    private async _inactivateInvalidExistingPermissions() {
        await Permission.createQueryBuilder()
            .update()
            .set({ allow: false })
            .where('Permission.allow = :allowed', {
                allowed: true,
            })
            .andWhere('Permission.permission_id NOT IN (:...names)', {
                names: Object.values(PermissionName),
            })
            .execute()
    }

    private async _createDefaultRoles(
        manager: EntityManager = getManager(),
        roles: Map<string, Role>
    ) {
        for (const { role_name, permissions } of this.systemRolesData) {
            let role = await manager.findOne(Role, {
                where: {
                    role_name: role_name,
                    system_role: true,
                    organization: { organization_id: null },
                },
            })

            if (!role) {
                role = new Role()
                role.role_name = role_name
                role.system_role = true
            }

            await this._assignPermissionsDefaultRoles(
                manager,
                role,
                permissions
            )

            roles.set(role_name, role)
        }

        return roles
    }

    private async _assignPermissionsDefaultRoles(
        manager: EntityManager,
        role: Role,
        permissions: string[]
    ) {
        role.permissions = Promise.resolve([])
        await manager.save(role)

        await manager
            .createQueryBuilder()
            .relation(Role, 'permissions')
            .of(role)
            .add(permissions)
    }

    private async _removeDuplicatedSystemRoles(
        manager: EntityManager = getManager()
    ) {
        const systemRoleNames = this.systemRolesData.map((d) => d.role_name)
        const systemRoles = await manager.find(Role, {
            where: {
                role_name: In(systemRoleNames),
                status: Status.ACTIVE,
                system_role: true,
                organization: { organization_id: null },
            },
        })

        // const rolesWithName = new Map<string, Role[]>()
        // const rolesToPersistMap = new Map<string, Role>()
        // const duplicatedRoleIds = new Set<string>()
        // systemRoles.forEach((r) => {
        //     const roleName = r.role_name!

        //     if (rolesToPersistMap.has(roleName)) {
        //         duplicatedRoleIds.add(r.role_id)
        //     } else {
        //         rolesToPersistMap.set(roleName, r)
        //     }
        // })

        // const orgMemberships = await manager.find(OrganizationMembership, {
        //     join: {
        //         alias: 'OrgMembership',
        //         innerJoin: {
        //             roles: 'OrgMembership.roles',
        //         },
        //     },
        //     where: (qb: WhereExpression) => {
        //         qb.where('roles.role_id IN (:...roleIds)', {
        //             roleIds: [...duplicatedRoleIds],
        //         })
        //     },
        // })

        // const schoolMemberships = await manager.find(SchoolMembership, {
        //     join: {
        //         alias: 'SchoolMembership',
        //         innerJoin: {
        //             roles: 'SchoolMembership.roles',
        //         },
        //     },
        //     where: (qb: WhereExpression) => {
        //         qb.where('roles.role_id IN (:...roleIds)', {
        //             roleIds: [...duplicatedRoleIds],
        //         })
        //     },
        // })

        if (systemRoles.length > systemRoleNames.length) {
            const {
                rolesToDelete,
                rolesToPersist,
                orgMemberships,
                schoolMemberships,
            } = await this._buildMaps(manager, systemRoles)

            await manager.transaction(async (transactionManager) => {
                // Migrating roles to be removed to the persisting ones in the org memberships involved
                await this._migrateMemberships(
                    transactionManager,
                    orgMemberships,
                    rolesToDelete,
                    rolesToPersist
                )

                // Migrating roles to be removed to the persisting ones in the school memberships involved
                await this._migrateMemberships(
                    transactionManager,
                    schoolMemberships,
                    rolesToDelete,
                    rolesToPersist
                )

                // Once these roles are not in any organization or school membership, they can be removed
                const deleteRoleIds = Array.from(rolesToDelete.values())
                    .flat()
                    .map((r) => r.role_id)

                await transactionManager.softDelete(Role, deleteRoleIds)
            })
        }
    }

    private async _buildMaps(manager: EntityManager, systemRoles: Role[]) {
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

    private async _migrateMemberships(
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

export default new RolesInitializer()
