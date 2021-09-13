import faker from 'faker'

import { createOrganization } from './organization.factory'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { PermissionName } from '../../src/permissions/permissionNames'
import { Permission } from '../../src/entities/permission'

export function createRole(
    role_name: string = faker.random.word(),
    org?: Organization,
    { permissions }: { permissions?: PermissionName[] } = {}
) {
    const role = new Role()

    role.role_name = role_name
    if (org) {
        role.organization = Promise.resolve(org)
    }
    role.role_description = faker.random.words()
    role.system_role = false
    if (permissions) {
        const permissionEntities = permissions.map((name) => {
            const perm = new Permission()
            perm.permission_name = name
            return perm
        })
        role.permissions = Promise.resolve(permissionEntities)
    }

    return role
}
