import { EntityManager, getManager } from 'typeorm'

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
        const roles = new Map<string, Role>()

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
        for (const { role_name, permissions } of [
            organizationAdminRole,
            schoolAdminRole,
            parentRole,
            studentRole,
            teacherRole,
        ]) {
            let role = await Role.findOne({
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
        await role.save()

        await manager
            .createQueryBuilder()
            .relation(Role, 'permissions')
            .of(role)
            .add(permissions)
    }
}

export default new RolesInitializer()
