import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Permission } from '../../entities/permission'
import { Role } from '../../entities/role'
import { RoleRow } from '../../types/csv/roleRow'
import { saveError } from './readFile'

export async function processRoleFromCSVRow(
    manager: EntityManager,
    row: RoleRow,
    rowNumber: number,
    fileErrors: string[]
) {
    let role
    let rolePermissions: Permission[] = []
    const { organization_name, role_name, permission_id } = row
    const requiredFieldsAreProvided =
        organization_name && role_name && permission_id

    if (!organization_name) {
        saveError(fileErrors, rowNumber, 'Organization name is not provided')
    }

    if (!role_name) {
        saveError(fileErrors, rowNumber, 'Role name is not provided')
    }

    if (!permission_id) {
        saveError(fileErrors, rowNumber, 'Permission id is not provided')
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        saveError(
            fileErrors,
            rowNumber,
            `Provided organization with name '${organization_name}' doesn't exist`
        )
    }

    const permission = await Permission.findOne({
        where: { permission_name: permission_id },
    })

    if (!permission) {
        saveError(
            fileErrors,
            rowNumber,
            `Provided permission with id '${permission_id}' doesn't exists in the system`
        )
    }

    if (!organization || !permission) {
        return
    }

    role = await manager.findOne(Role, {
        where: {
            role_name,
            status: 'active',
            system_role: false,
            organization,
        },
    })

    if (role) {
        rolePermissions = (await role?.permissions) || []
        const permissionNames = rolePermissions.map(
            ({ permission_name }) => permission_name
        )

        if (permissionNames.includes(permission_id)) {
            saveError(
                fileErrors,
                rowNumber,
                `Provided permission with id '${permission_id}' already exists for this role`
            )

            return
        }
    } else {
        role = new Role()
        role.role_name = role_name
        role.organization = Promise.resolve(organization)
    }

    rolePermissions.push(permission)
    role.permissions = Promise.resolve(rolePermissions)

    await manager.save(role)
}
