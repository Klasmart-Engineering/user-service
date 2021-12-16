import faker from 'faker'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { PermissionName } from '../../src/permissions/permissionNames'
import { Permission } from '../../src/entities/permission'

export function createRole(
    roleName: string = faker.random.word(),
    org?: Organization,
    { permissions }: { permissions?: PermissionName[] } = {}
) {
    const role = new Role()

    role.role_name = roleName
    if (org) {
        role.organization = Promise.resolve(org)
    }
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

export const createRoles = (length: number) =>
    Array(length)
        .fill(undefined)
        .map(() => createRole())
