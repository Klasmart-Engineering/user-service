import { MigrationInterface, QueryRunner } from 'typeorm'
import { Permission } from '../src/entities/permission'
import { Role } from '../src/entities/role'
import { logger } from '../src/logging'

export class RolesMissingDeactivateUserSchools1645517302183
    implements MigrationInterface {
    name = 'RolesMissingDeactivateUserSchools1645517302183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // get ids for roles that have edit_school_20330 but not deactivate_my_school_user_40885
        const roleIds: string[] = await queryRunner.query(`
            SELECT
            role.role_id
            FROM
                role
                JOIN permission_roles_role AS edit_perm ON edit_perm."roleRoleId" = role.role_id
                AND edit_perm."permissionPermissionId" = 'edit_school_20330'
                LEFT JOIN permission_roles_role AS deactivate_perm ON deactivate_perm."roleRoleId" = role.role_id
                AND deactivate_perm."permissionPermissionId" = 'deactivate_my_school_user_40885'
            WHERE
                role.status = 'active'
                AND role.system_role IS NOT TRUE
                AND deactivate_perm."permissionPermissionId" IS NULL;`)
        const permission = await queryRunner.manager.findOneBy(Permission, {
            permission_name: 'deactivate_my_school_user_40885',
        })

        if (permission === undefined) {
            logger.warn(
                `Couldn't find permission deactivate_my_school_user_40885, skipping migration ${this.name}`
            )
        } else {
            const roles = await queryRunner.manager.findByIds(Role, roleIds)
            const updatedRoles = await Promise.all(
                roles.map(async (role) => {
                    const rolePromises = await role!.permissions!
                    rolePromises.push(permission)
                    role!.permissions = Promise.resolve(rolePromises)
                    return role
                })
            )
            await queryRunner.manager.save(updatedRoles)
        }
    }

    public async down() {
        // can't reverse migration because we can't
        // tell the difference between roles we added deactivate_my_school_user_40885 to
        // and those that already had it
    }
}
