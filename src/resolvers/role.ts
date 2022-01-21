import { In } from 'typeorm'
import { Organization } from '../entities/organization'
import { Permission } from '../entities/permission'
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
    UpdateRoleInput,
} from '../types/graphQL/role'
import {
    CreateMutation,
    DeleteEntityMap,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
    UpdateMutation,
    validateActiveAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createInputRequiresAtLeastOne,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers/errors'

type RoleAndOrg = Role & {
    __organization__: Organization
}
export interface CreateRoleEntityMap extends EntityMap<Role> {
    mainEntity: Map<string, Role>
    organizations: Map<string, Organization>
}

export class CreateRoles extends CreateMutation<
    Role,
    CreateRoleInput,
    RolesMutationResult,
    CreateRoleEntityMap
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

    generateEntityMaps = (input: CreateRoleInput[]) =>
        generateMapsForCreate(input, this.orgIds)

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.orgIds },
            PermissionName.create_role_with_permissions_30222
        )
    }

    validationOverAllInputs(inputs: CreateRoleInput[]) {
        return {
            validInputs: inputs.map((i, index) => {
                return { input: i, index }
            }),
            apiErrors: [],
        }
    }

    protected validate(
        index: number,
        _entity: Role,
        currentInput: CreateRoleInput,
        maps: CreateRoleEntityMap
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
                    'existentChild',
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
        currentInput: CreateRoleInput,
        maps: CreateRoleEntityMap
    ) {
        const { organizationId, roleName, roleDescription } = currentInput
        const role = new Role()

        role.role_name = roleName
        role.role_description = roleDescription
        role.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        return { outputEntity: role }
    }

    protected async buildOutput(outputEntity: Role): Promise<void> {
        const roleConnectionNode = await mapRoleToRoleConnectionNode(
            outputEntity
        )

        this.output.roles.push(roleConnectionNode)
    }
}

interface UpdateRolesEntityMap extends EntityMap<Role> {
    mainEntity: Map<string, Role>
    permissions: Map<string, Permission>
    matchingOrgsAndNames: Map<string, Role>
    newNames: Map<string, Role>
}

export class UpdateRoles extends UpdateMutation<
    Role,
    UpdateRoleInput,
    RolesMutationResult,
    UpdateRolesEntityMap
> {
    protected readonly EntityType = Role
    protected readonly EntityPrimaryKey = Role
    protected readonly inputTypeName = 'UpdateRoleInput'
    protected readonly mainEntityIds: string[]
    protected readonly output: RolesMutationResult = { roles: [] }

    constructor(input: UpdateRoleInput[], permissions: Context['permissions']) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(input: UpdateRoleInput[]) {
        const names = input.map((val) => val.roleName)
        const ids = input.map((val) => val.permissionIds).flat()
        const preloadedRoleArray = Role.find({
            where: {
                role_id: In(this.mainEntityIds),
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        const matchingPreloadedRoleArray = Role.find({
            where: {
                role_name: In(names),
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        const preloadedPermissionArray = Permission.find({
            where: {
                permission_name: In(ids),
                status: Status.ACTIVE,
            },
        })

        const mainEntity = new Map(
            (await preloadedRoleArray).map((r) => [r.role_id, r])
        )

        const matchingOrgsAndNames = new Map<string, Role>()
        const newNames = new Map<string, Role>()

        for (const r of await matchingPreloadedRoleArray) {
            // eslint-disable-next-line no-await-in-loop
            const orgId = (await r.organization)?.organization_id || ''
            matchingOrgsAndNames.set([orgId, r.role_name].toString(), r)
        }

        for (const i of input) {
            const role = mainEntity.get(i.id)

            if (role && i.roleName) {
                role.role_name = i.roleName
                newNames.set(i.id, role)
            }
        }

        return {
            mainEntity,
            permissions: new Map(
                (await preloadedPermissionArray).map((p) => [
                    p.permission_name,
                    p,
                ])
            ),
            matchingOrgsAndNames,
            newNames,
        }
    }

    protected async authorize(
        _input: UpdateRoleInput[],
        entityMaps: UpdateRolesEntityMap
    ) {
        const organizationIds: string[] = []

        for (const c of entityMaps.mainEntity.values()) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await c.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_role_and_permissions_30332
        )
    }

    protected validationOverAllInputs(
        inputs: UpdateRoleInput[],
        entityMaps: UpdateRolesEntityMap
    ): {
        validInputs: { index: number; input: UpdateRoleInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.id),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate(
        index: number,
        currentEntity: Role,
        currentInput: UpdateRoleInput,
        maps: UpdateRolesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { roleName, roleDescription, permissionIds } = currentInput

        if (!roleName && !roleDescription && !permissionIds) {
            errors.push(
                createInputRequiresAtLeastOne(index, 'Role', [
                    'roleName',
                    'roleDescription',
                    'permissionIds',
                ])
            )
        }

        if (roleName) {
            const organizationId = (currentEntity as RoleAndOrg)
                .__organization__?.organization_id

            const matchingOrgAndName = maps.matchingOrgsAndNames.get(
                [organizationId, roleName].toString()
            ) as Role

            if (
                matchingOrgAndName &&
                matchingOrgAndName.role_id !== currentEntity.role_id
            ) {
                errors.push(
                    createEntityAPIError(
                        'existentChild',
                        index,
                        'Role',
                        roleName,
                        'Organization',
                        organizationId,
                        ['organizationId', 'name']
                    )
                )
            }

            const newNames = [...maps.newNames.values()] as RoleAndOrg[]
            const inputNameDuplicated = newNames.find((nn, i) => {
                const sameName = nn.role_name === roleName
                const sameOrg =
                    nn.__organization__?.organization_id === organizationId
                const differentId = nn.role_id !== currentEntity.role_id
                return sameName && sameOrg && differentId && index > i
            })

            if (inputNameDuplicated) {
                errors.push(
                    createDuplicateAttributeAPIError(
                        index,
                        ['roleName'],
                        'UpdateRoleInput'
                    )
                )
            }
        }

        if (permissionIds) {
            const uniquePermissionIds = new Set(permissionIds)

            if (uniquePermissionIds.size < permissionIds.length) {
                errors.push(
                    createDuplicateAttributeAPIError(
                        index,
                        ['permissionIds'],
                        'UpdateRoleInput'
                    )
                )
            }

            for (const pid of permissionIds) {
                const permissionExists = maps.permissions.has(pid)

                if (!permissionExists) {
                    errors.push(
                        createEntityAPIError(
                            'nonExistent',
                            index,
                            'Permission',
                            pid
                        )
                    )
                }
            }
        }

        return errors
    }

    protected process(
        currentInput: UpdateRoleInput,
        entityMaps: UpdateRolesEntityMap,
        index: number
    ) {
        const { roleName, roleDescription, permissionIds } = currentInput

        const currentEntity = entityMaps.mainEntity.get(
            this.mainEntityIds[index]
        )!

        currentEntity.role_name = roleName || currentEntity.role_name
        currentEntity.role_description =
            roleDescription || currentEntity.role_description

        if (permissionIds) {
            currentEntity.permissions = Promise.resolve(
                Array.from(
                    permissionIds,
                    (pid) => entityMaps.permissions.get(pid) as Permission
                )
            )
        }

        return { outputEntity: currentEntity }
    }

    protected async buildOutput(proccesedEntity: Role): Promise<void> {
        this.output.roles.push(
            await mapRoleToRoleConnectionNode(proccesedEntity)
        )
    }
}
export interface DeleteRoleEntityMap extends DeleteEntityMap<Role> {
    mainEntity: Map<string, Role>
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

    protected async generateEntityMaps(): Promise<DeleteEntityMap<Role>> {
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
        entityMaps: DeleteRoleEntityMap
    ) {
        const organizationIds: string[] = []
        for (const r of entityMaps.mainEntity.values()) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await r.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_role_30440
        )
    }

    protected async buildOutput(currentEntity: Role): Promise<void> {
        this.output.roles.push(mapRoleToRoleConnectionNode(currentEntity))
    }
}

async function generateMapsForCreate(
    input: CreateRoleInput[],
    organizationIds: string[]
): Promise<CreateRoleEntityMap> {
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
