import { Role } from '../entities/role'
import { Context } from '../main'
import {
    mapRoleToRoleConnectionNode,
    roleConnectionNodeFields,
} from '../pagination/rolesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { DeleteRoleInput, RolesMutationResult } from '../types/graphQL/role'
import { DeleteMutation, EntityMap } from '../utils/mutations/commonStructure'

export class DeleteRoles extends DeleteMutation<
    Role,
    DeleteRoleInput,
    RolesMutationResult
> {
    protected readonly EntityType = Role
    protected readonly inputTypeName = 'DeleteRoleInput'
    protected readonly output: RolesMutationResult = { roles: [] }
    protected readonly mainEntityIds: string[]

    constructor(input: DeleteRoleInput[], permissions: Context['permissions']) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(): Promise<EntityMap<Role>> {
        const roles = await Role.createQueryBuilder()
            .select([
                ...roleConnectionNodeFields,
                'Organization.organization_id',
            ])
            .leftJoin('Role.organization', 'Organization')
            .where('Role.role_id IN (:...ids)', { ids: this.mainEntityIds })
            .getMany()

        return { mainEntity: new Map(roles.map((r) => [r.role_id, r])) }
    }

    protected async authorize(
        _input: DeleteRoleInput[],
        entityMaps: EntityMap<Role>
    ) {
        const organizationIds: string[] = []
        for (const r of entityMaps.mainEntity.values()) {
            const organizationId = (await r.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_role_30440
        )
    }

    protected buildOutput(currentEntity: Role): void {
        this.output.roles.push(mapRoleToRoleConnectionNode(currentEntity))
    }
}
