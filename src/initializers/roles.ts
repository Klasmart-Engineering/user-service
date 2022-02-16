import { EntityManager, getManager, In } from 'typeorm'

import { Permission } from '../entities/permission'
import { organizationAdminRole } from '../permissions/organizationAdmin'
import { parentRole } from '../permissions/parent'
import { permissionInfo } from '../permissions/permissionInfo'
import { PermissionName } from '../permissions/permissionNames'
import { Role } from '../entities/role'
import { schoolAdminRole } from '../permissions/schoolAdmin'
import { studentRole } from '../permissions/student'
import { teacherRole } from '../permissions/teacher'

export class RolesInitializer {
    public async run() {
        let roles: Role[] = []

        await this.createSystemPermissions()

        await getManager().transaction(async (manager) => {
            roles = await this._createDefaultRoles(manager)
            await this._removeInactivePermissionsFromCustomRoles(manager)
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
        manager: EntityManager = getManager()
    ): Promise<Role[]> {
        const defaultRoles = [
            organizationAdminRole,
            schoolAdminRole,
            parentRole,
            studentRole,
            teacherRole,
        ]

        const roleNames = defaultRoles.map((r) => r.role_name)
        const dbRolesMap = await manager
            .find(Role, {
                where: {
                    role_name: In(roleNames),
                    system_role: true,
                    organization: { organization_id: null },
                },
            })
            .then((dbRoles) => {
                return new Map(dbRoles.map((r) => [r.role_name!, r]))
            })

        const roles: Role[] = []
        for (const { role_name, permissions } of defaultRoles) {
            let role = dbRolesMap.get(role_name)
            if (!role) {
                role = new Role()
                role.role_name = role_name
                role.system_role = true
            }
            role.permissions = Promise.resolve(
                permissions.map((p) => {
                    return { permission_name: p } as Permission
                })
            )
            roles.push(role)
        }

        return manager.save(roles)
    }

    private async _assignPermissionsRoles(
        manager: EntityManager,
        role: Role,
        permissions: Permission[]
    ) {
        role.permissions = Promise.resolve(permissions)
        await manager.save(role)
    }

    private async _removeInactivePermissionsFromCustomRoles(
        manager: EntityManager
    ) {
        const roles = await manager
            .createQueryBuilder(Role, 'role')
            .innerJoin('role.permissions', 'permission')
            .where('permission.allow = :allowed', { allowed: false })
            .andWhere('role.system_role = :system_role', { system_role: false })
            .getMany()

        const permissionsArrayPromise: (
            | Promise<Permission[]>
            | undefined
        )[] = []

        const assignmentsPromise: (Promise<void> | undefined)[] = []
        for (const role of roles) {
            assignmentsPromise.push(
                role.permissions?.then((p) => {
                    return this._assignPermissionsRoles(
                        manager,
                        role,
                        p.filter(function (perm) {
                            return perm.allow === true
                        })
                    )
                })
            )
        }
        await Promise.all(assignmentsPromise)
    }
}

export default new RolesInitializer()
