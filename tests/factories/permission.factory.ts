import faker from 'faker'
import { Permission } from '../../src/entities/permission'
import { Role } from '../../src/entities/role'
import { createRole } from './role.factory'

export function createPermission(role: Role = createRole()) {
    const permission = new Permission()

    permission.roles = Promise.resolve([role])
    // in production, permission_id and permission_name have the same values
    // however use different values here to fail fast
    // if code switches between them inconsistantly
    permission.permission_id = faker.random.word()
    permission.permission_name = faker.random.word()
    permission.allow = true
    permission.permission_category = faker.random.word()
    permission.permission_group = faker.random.word()
    permission.permission_level = faker.random.word()
    permission.permission_description = faker.random.words()

    return permission
}
