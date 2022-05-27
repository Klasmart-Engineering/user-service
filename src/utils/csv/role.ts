import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Permission } from '../../entities/permission'
import { Role } from '../../entities/role'
import { RoleRow } from '../../types/csv/roleRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import { UserPermissions } from '../../permissions/userPermissions'
import { Status } from '../../entities/status'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processRoleFromCSVRow = async (
    manager: EntityManager,
    row: RoleRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    let role
    let rolePermissions: Permission[] = []
    const { organization_name, role_name, permission_id } = row

    if (!organization_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'organization_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!role_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'role_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'role',
                attribute: 'name',
            }
        )
    }

    if (!permission_id) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'permission_id',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'permission',
                attribute: 'id',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entity: 'organization',
                entityName: organization_name,
            }
        )
        return rowErrors
    }

    // Is the user authorized to upload roles to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_role_with_permissions_30222
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'role',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
    }

    const permission = await Permission.findOne({
        where: { permission_name: permission_id },
    })

    if (!permission) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entity: 'permission',
                entityName: permission_id,
            }
        )
    }

    if (rowErrors.length > 0 || !organization || !permission) {
        return rowErrors
    }

    role = await manager.findOne(Role, {
        where: {
            role_name,
            status: Status.ACTIVE,
            system_role: false,
            organization: { organization_id: organization.organization_id },
        },
    })

    if (role) {
        rolePermissions = (await role?.permissions) || []
        const permissionNames = rolePermissions.map(
            ({ permission_name }) => permission_name
        )

        if (permissionNames.includes(permission_id)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'permission_id',
                customErrors.existent_child_entity.message,
                {
                    entity: 'permission',
                    entityName: permission_id,
                    parentEntity: 'role',
                    parentName: role_name,
                }
            )

            return rowErrors
        }
    } else {
        role = new Role()
        role.role_name = role_name
        role.organization = Promise.resolve(organization)
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    rolePermissions.push(permission)
    role.permissions = Promise.resolve(rolePermissions)

    await manager.save(role)

    return rowErrors
}
