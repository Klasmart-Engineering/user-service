import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Permission } from '../../entities/permission'
import { Role } from '../../entities/role'
import { RoleRow } from '../../types/csv/roleRow'

export async function processRoleFromCSVRow(
    manager: EntityManager,
    row: RoleRow,
    rowNumber: number
) {
    let role
    let organization
    let permission
    let rolePermissions: Permission[] = []
    const { organization_name, role_name, permission_id } = row

    try {
        if (!organization_name) {
            throw new Error('Organization name is not provided')
        }

        if (!role_name) {
            throw new Error('Role name is not provided')
        }

        if (!permission_id) {
            throw new Error('Permission id is not provided')
        }

        organization = await Organization.findOne({
            where: { organization_name },
        })

        if (!organization) {
            throw new Error(
                `Provided organization with name ${organization_name} doesn't exist`
            )
        }

        permission = await Permission.findOne({
            where: { permission_name: permission_id },
        })

        if (!permission) {
            throw new Error(
                `Provided permission with id ${permission_id} doesn't exists in the system`
            )
        }

        role = await manager.findOne(Role, {
            where: {
                role_name,
                status: 'active',
                system_role: false,
                organization: { organization_name },
            },
        })

        if (role) {
            rolePermissions = (await role?.permissions) || []

            if (rolePermissions.includes(permission)) {
                throw new Error(
                    `Provided permission with id ${permission_id} already exists for this role`
                )
            }
        } else {
            role = new Role()
            role.role_name = role_name
            role.organization = Promise.resolve(organization)
        }

        rolePermissions.push(permission)
        role.permissions = Promise.resolve(rolePermissions)

        await manager.save(role)
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
