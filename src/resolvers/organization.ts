import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
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
import { config } from '../config/config'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import {
    RemoveMembershipMutation,
    EntityMap,
    AddMembershipMutation,
    ProcessedResult,
    validateActiveAndNoDuplicates,
    filterInvalidInputs,
} from '../utils/mutations/commonStructure'
import { ObjMap } from '../utils/stringUtils'
import { getMap } from '../utils/resolvers/entityMaps'
import {
    flagExistentOrganizationMembership,
    flagNonExistent,
    flagNonExistentOrganizationMembership,
} from '../utils/resolvers/inputValidation'

interface RemoveUsersFromOrganizationsEntityMap
    extends EntityMap<Organization> {
    mainEntity: Map<string, Organization>
    users: Map<string, User>
    memberships: ObjMap<
        { organizationId: string; userId: string },
        OrganizationMembership
    >
}
interface AddUsersToOrganizationsEntityMap
    extends RemoveUsersFromOrganizationsEntityMap {
    roles: Map<string, Role>
}

export class AddUsersToOrganizations extends AddMembershipMutation<
    Organization,
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    AddUsersToOrganizationsEntityMap,
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
        generateAddRemoveOrgUsersMap(this.mainEntityIds, input)

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
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.organizationId),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate(
        index: number,
        _currentEntity: Organization,
        currentInput: AddUsersToOrganizationInput,
        maps: AddUsersToOrganizationsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, organizationRoleIds, userIds } = currentInput

        const users = flagNonExistent(User, index, userIds, maps.users)
        errors.push(...users.errors)

        const roles = flagNonExistent(
            Role,
            index,
            organizationRoleIds,
            maps.roles
        )
        errors.push(...roles.errors)

        if (!users.values.length) return errors
        const memberships = flagExistentOrganizationMembership(
            index,
            organizationId,
            users.values.map((u) => u.user_id),
            maps.memberships
        )
        errors.push(...memberships.errors)

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
    RemoveUsersFromOrganizationsEntityMap,
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
        generateAddRemoveOrgUsersMap(this.mainEntityIds, input)

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
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.organizationId),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate(
        index: number,
        _currentEntity: Organization,
        currentInput: RemoveUsersFromOrganizationInput,
        maps: RemoveUsersFromOrganizationsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, userIds } = currentInput

        const users = flagNonExistent(User, index, userIds, maps.users)
        errors.push(...users.errors)

        if (!users.values.length) return errors
        const memberships = flagNonExistentOrganizationMembership(
            index,
            organizationId,
            users.values.map((u) => u.user_id),
            maps.memberships
        )
        errors.push(...memberships.errors)

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
            const membership = maps.memberships.get({ organizationId, userId })!
            Object.assign(membership, this.partialEntity)
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, others: memberships }
    }

    protected buildOutput = async (
        currentEntity: Organization
    ): Promise<void> => addOrgToOutput(currentEntity, this.output)
}

async function generateAddRemoveOrgUsersMap(
    organizationIds: string[],
    input: {
        userIds: string[]
        organizationRoleIds?: string[]
    }[]
): Promise<AddUsersToOrganizationsEntityMap> {
    const orgMap = getMap.organization(organizationIds)
    const userMap = getMap.user(input.flatMap((i) => i.userIds))

    const orgRoleIds = input
        .flatMap((i) => i.organizationRoleIds)
        .filter((rid): rid is string => rid !== undefined)
    const roleMap = getMap.role(orgRoleIds)

    const membershipMap = getMap.membership.organization(
        organizationIds,
        input.flatMap((i) => i.userIds)
    )

    return {
        mainEntity: await orgMap,
        users: await userMap,
        roles: await roleMap,
        memberships: await membershipMap,
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
