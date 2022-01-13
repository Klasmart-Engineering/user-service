import { In } from 'typeorm'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { Status } from '../entities/status'
import { User } from '../entities/user'
import { Context } from '../main'
import { mapOrganizationToOrganizationConnectionNode } from '../pagination/organizationsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    RemoveUsersFromOrganizationInput,
} from '../types/graphQL/organization'
import { createEntityAPIError } from '../utils/resolvers/errors'
import { config } from '../config/config'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import {
    RemoveMembershipMutation,
    EntityMap,
    AddMembershipMutation,
    ProcessedResult,
    validateActiveAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { getMembershipMapKey } from '../utils/resolvers/entityMaps'

export interface AddUsersToOrganizationsEntityMap
    extends EntityMap<Organization> {
    mainEntity: Map<string, Organization>
    users: Map<string, User>
    roles: Map<string, Role>
    memberships: Map<string, OrganizationMembership>
}

type RemoveUsersFromOrganizationsEntityMap = AddUsersToOrganizationsEntityMap

export class AddUsersToOrganizations extends AddMembershipMutation<
    Organization,
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    OrganizationMembership
> {
    protected readonly EntityType = Organization
    protected inputTypeName = 'AddUsersToOrganizationInput'
    protected output: OrganizationsMutationResult = { organizations: [] }
    protected mainEntityIds: string[]

    constructor(
        input: AddUsersToOrganizationInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.organizationId)
    }

    generateEntityMaps = (
        input: AddUsersToOrganizationInput[]
    ): Promise<AddUsersToOrganizationsEntityMap> =>
        generateMaps(this.mainEntityIds, input)

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.send_invitation_40882
        )
    }

    protected validationOverAllInputs(
        inputs: AddUsersToOrganizationInput[],
        entityMaps: AddUsersToOrganizationsEntityMap
    ): {
        validInputs: { index: number; input: AddUsersToOrganizationInput }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.organizationId),
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate(
        index: number,
        currentEntity: Organization,
        currentInput: AddUsersToOrganizationInput,
        maps: AddUsersToOrganizationsEntityMap
    ): APIError[] {
        // Retrieval
        const errors: APIError[] = []
        const { organizationId, organizationRoleIds, userIds } = currentInput

        // Role validation
        const missingRoleIds: string[] = organizationRoleIds.reduce(
            (acc: string[], orgRoleId: string) => {
                if (!maps.roles.has(orgRoleId)) acc.push(orgRoleId)
                return acc
            },
            []
        )
        if (missingRoleIds.length) {
            errors.push(
                createEntityAPIError(
                    'nonExistent',
                    index,
                    'Role',
                    missingRoleIds.toString()
                )
            )
        }

        for (const userId of userIds) {
            // User validation
            const user = maps.users.get(userId) as User
            if (!user) {
                errors.push(
                    createEntityAPIError('nonExistent', index, 'User', userId)
                )
                continue
            }
            // Membership validation
            if (
                maps.memberships.has(
                    getMembershipMapKey(organizationId, userId)
                )
            ) {
                errors.push(
                    createEntityAPIError(
                        'duplicateChild',
                        index,
                        'User',
                        user.user_name(),
                        'Organization',
                        currentEntity.organization_name,
                        ['organization_id', 'user_id']
                    )
                )
            }
        }
        return errors
    }

    protected process(
        currentInput: AddUsersToOrganizationInput,
        maps: AddUsersToOrganizationsEntityMap,
        index: number
    ): ProcessedResult<Organization, OrganizationMembership> {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        // Retrieval
        const { organizationId, organizationRoleIds, userIds } = currentInput
        const roles = organizationRoleIds.map(
            (ori) => maps.roles.get(ori) as Role
        )
        const shortcode = formatShortCode(currentInput.shortcode)

        // Create new memberships in organisation
        const memberships: OrganizationMembership[] = []
        for (const userId of userIds) {
            const user = maps.users.get(userId) as User
            const membership = new OrganizationMembership()
            membership.organization_id = organizationId
            membership.roles = Promise.resolve(roles)
            membership.organization = Promise.resolve(currentEntity)
            membership.user_id = userId
            membership.user = Promise.resolve(user)
            membership.shortcode =
                shortcode ||
                generateShortCode(userId, config.limits.SHORTCODE_MAX_LENGTH)
            memberships.push(membership)
        }
        return { outputEntity: currentEntity, modifiedEntity: memberships }
    }

    protected buildOutput = async (
        currentEntity: Organization
    ): Promise<void> => addOrgToOutput(currentEntity, this.output)
}

export class RemoveUsersFromOrganizations extends RemoveMembershipMutation<
    Organization,
    RemoveUsersFromOrganizationInput,
    OrganizationsMutationResult,
    OrganizationMembership
> {
    protected readonly EntityType = Organization
    protected readonly MembershipType = OrganizationMembership
    protected inputTypeName = 'RemoveUsersFromOrganizationInput'
    protected output: OrganizationsMutationResult = { organizations: [] }
    protected mainEntityIds: string[]
    protected readonly saveIds: Record<string, string>[]

    constructor(
        input: RemoveUsersFromOrganizationInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.organizationId)
        this.saveIds = input.flatMap((i) =>
            i.userIds.map((user_id) => {
                return {
                    user_id,
                    organization_id: i.organizationId,
                }
            })
        )
    }

    generateEntityMaps = (
        input: RemoveUsersFromOrganizationInput[]
    ): Promise<RemoveUsersFromOrganizationsEntityMap> =>
        generateMaps(this.mainEntityIds, input)

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.edit_this_organization_10330
        )
    }

    protected validationOverAllInputs(
        inputs: RemoveUsersFromOrganizationInput[],
        entityMaps: RemoveUsersFromOrganizationsEntityMap
    ): {
        validInputs: {
            index: number
            input: RemoveUsersFromOrganizationInput
        }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.organizationId),
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate(
        index: number,
        currentEntity: Organization,
        currentInput: RemoveUsersFromOrganizationInput,
        maps: RemoveUsersFromOrganizationsEntityMap
    ): APIError[] {
        // Retrieval
        const errors: APIError[] = []
        const { organizationId, userIds } = currentInput

        for (const userId of userIds) {
            // User validation
            const user = maps.users.get(userId) as User
            if (!user) {
                errors.push(
                    createEntityAPIError('nonExistent', index, 'User', userId)
                )
                continue
            }
            // Membership validation
            if (
                !maps.memberships.has(
                    getMembershipMapKey(organizationId, userId)
                )
            ) {
                errors.push(
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'User',
                        user.user_name() || user.user_id,
                        'Organization',
                        currentEntity.organization_name || organizationId,
                        ['organization_id', 'user_id']
                    )
                )
            }
        }
        return errors
    }

    protected process(
        currentInput: RemoveUsersFromOrganizationInput,
        maps: RemoveUsersFromOrganizationsEntityMap,
        index: number
    ) {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const { organizationId, userIds } = currentInput
        const memberships: OrganizationMembership[] = []
        for (const userId of userIds) {
            const membership = maps.memberships.get(
                getMembershipMapKey(organizationId, userId)
            ) as OrganizationMembership
            Object.assign(membership, this.partialEntity)
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, others: memberships }
    }

    protected buildOutput = async (
        currentEntity: Organization
    ): Promise<void> => addOrgToOutput(currentEntity, this.output)
}

async function generateMaps(
    organizationIds: string[],
    input: {
        userIds: string[]
        organizationRoleIds?: string[]
    }[]
): Promise<AddUsersToOrganizationsEntityMap> {
    const preloadedOrgArray = Organization.findByIds(organizationIds, {
        where: { status: Status.ACTIVE },
    })
    const preloadedUserArray = User.findByIds(
        input.map((i) => i.userIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    let preloadedRoleArray: Promise<Role[]> = Promise.resolve([])
    // Check that we are dealing with AddUsersToOrganizationInput & not RemoveUsersFromOrganizationInput
    if (input.some((i) => i.organizationRoleIds)) {
        preloadedRoleArray = Role.findByIds(
            input.flatMap((i) => i.organizationRoleIds),
            { where: { status: Status.ACTIVE } }
        )
    }
    const preloadedMembershipArray = OrganizationMembership.find({
        where: {
            user_id: In(input.map((i) => i.userIds).flat()),
            organization_id: In(organizationIds),
            status: Status.ACTIVE,
        },
    })

    return {
        mainEntity: new Map(
            (await preloadedOrgArray).map((i) => [i.organization_id, i])
        ),
        users: new Map((await preloadedUserArray).map((i) => [i.user_id, i])),
        roles: new Map((await preloadedRoleArray).map((i) => [i.role_id, i])),
        memberships: new Map(
            (await preloadedMembershipArray).map((i) => [
                getMembershipMapKey(i.organization_id, i.user_id),
                i,
            ])
        ),
    }
}

function addOrgToOutput(
    organization: Organization,
    output: OrganizationsMutationResult
): void {
    output.organizations.push(
        mapOrganizationToOrganizationConnectionNode(organization)
    )
}
