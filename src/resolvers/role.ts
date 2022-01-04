import { In } from 'typeorm'
import { Organization } from '../entities/organization'
import { Role } from '../entities/role'
import { Status } from '../entities/status'
import { Context } from '../main'
import {
    mapRoleToRoleConnectionNode,
    roleConnectionNodeFields,
} from '../pagination/rolesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateRoleInput,
    DeleteRoleInput,
    RolesMutationResult,
} from '../types/graphQL/role'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
} from '../utils/mutations/commonStructure'
import {
    createEntityAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers'

export class CreateRoles extends CreateMutation<
    Role,
    CreateRoleInput,
    RolesMutationResult
> {
    protected readonly EntityType = Role
    protected inputTypeName = 'CreateRoleInput'
    protected mainEntityIds: string[] = []
    protected orgIds: string[]
    protected output: RolesMutationResult = { roles: [] }

    constructor(input: CreateRoleInput[], permissions: Context['permissions']) {
        super(input, permissions)
        this.orgIds = Array.from(
            new Set(input.map((val) => val.organizationId).flat())
        )

        for (const val of input) {
            this.mainEntityIds.push(
                [val.organizationId, val.roleName].toString()
            )
        }
    }

    generateEntityMaps = (input: CreateRoleInput[]): Promise<EntityMap<Role>> =>
        generateMapsForCreate(input, this.orgIds)

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.orgIds },
            PermissionName.create_role_with_permissions_30222
        )
    }

    protected validate(
        index: number,
        _entity: Role,
        currentInput: CreateRoleInput,
        maps: EntityMap<Role>
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, roleName } = currentInput
        const organization = maps.organizations.get(organizationId)

        if (!organization) {
            errors.push(
                createNonExistentOrInactiveEntityAPIError(
                    index,
                    ['organization_id'],
                    'ID',
                    'Organization',
                    organizationId
                )
            )
        }

        const roleExist = maps.mainEntity.get(
            [organizationId, roleName].toString()
        )

        if (roleExist) {
            errors.push(
                createEntityAPIError(
                    'duplicateChild',
                    index,
                    'Role',
                    roleName,
                    'Organization',
                    organizationId,
                    ['organizationId', 'name']
                )
            )
        }

        return errors
    }

    protected process(
        _entity: Role,
        currentInput: CreateRoleInput,
        maps: EntityMap<Role>
    ): Role[] {
        const { organizationId, roleName, roleDescription } = currentInput
        const role = new Role()

        role.role_name = roleName
        role.role_description = roleDescription
        role.organization = Promise.resolve(
            maps.organizations.get(organizationId) as Organization
        )

        return [role]
    }

    protected async buildOutput(): Promise<void> {
        this.output.roles = []

        for (const processedEntity of this.processedEntities) {
            // eslint-disable-next-line no-await-in-loop
            const roleConnectionNode = await mapRoleToRoleConnectionNode(
                processedEntity
            )

            this.output.roles.push(roleConnectionNode)
        }
    }
}

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

async function generateMapsForCreate(
    input: CreateRoleInput[],
    organizationIds: string[]
): Promise<EntityMap<Role>> {
    const matchingOrgsAndNames = await getOrgsAndNames(organizationIds, input)
    const preloadedOrgArray = Organization.find({
        where: {
            status: Status.ACTIVE,
            organization_id: In(organizationIds),
        },
    })

    return {
        mainEntity: matchingOrgsAndNames,
        organizations: new Map(
            (await preloadedOrgArray).map((i) => [i.organization_id, i])
        ),
    }
}

const getOrgsAndNames = async (orgIds: string[], input: CreateRoleInput[]) => {
    const names = input.map((val) => val.roleName)
    const matchingPreloadedRoleArray = Role.find({
        where: {
            role_name: In(names),
            status: Status.ACTIVE,
            organization: In(orgIds),
        },
        relations: ['organization'],
    })

    const matchingOrgsAndNames = new Map<string, Role>()

    for (const r of await matchingPreloadedRoleArray) {
        // eslint-disable-next-line no-await-in-loop
        const orgId = (await r.organization)?.organization_id || ''
        matchingOrgsAndNames.set([orgId, r.role_name].toString(), r)
    }

    return matchingOrgsAndNames
}
