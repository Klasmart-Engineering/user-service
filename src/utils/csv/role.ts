import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Permission } from '../../entities/permission'
import { Role } from '../../entities/role'
import { RoleRow } from '../../types/csv/roleRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from './errors/csvErrorConstants'

export async function processRoleFromCSVRow(
    manager: EntityManager,
    row: RoleRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
    let role
    let rolePermissions: Permission[] = []
    const { organization_name, role_name, permission_id } = row

    if (!organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!role_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'role_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'role',
                attribute: 'name',
            }
        )
    }

    if (!permission_id) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'permission_id',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'permission',
                attribute: 'id',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                entity: 'organization',
                name: organization_name,
            }
        )
    }

    const permission = await Permission.findOne({
        where: { permission_name: permission_id },
    })

    if (!permission) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                entity: 'permission',
                name: permission_id,
            }
        )
    }

    if ((fileErrors && fileErrors.length > 0) || !organization || !permission) {
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
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'permission_id',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'permission',
                    name: permission_id,
                    parent_entity: 'role',
                    parent_name: role_name,
                }
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
