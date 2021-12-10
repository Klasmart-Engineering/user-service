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
import { customErrors } from '../types/errors/customError'
import {
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
} from '../types/graphQL/organization'
import { createEntityAPIError } from '../utils/resolvers'
import { config } from '../config/config'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import { AddMutation, EntityMap } from '../utils/ mutations/commonStructure'

export class AddUsersToOrganizations extends AddMutation<
    Organization,
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    OrganizationMembership
> {
    protected readonly EntityType = Organization
    protected inputTypeName = 'AddUsersToOrganizationInput'
    protected mainEntityIds: string[]
    protected output: OrganizationsMutationResult

    constructor(
        input: AddUsersToOrganizationInput[],
        context: Pick<Context, 'permissions'>
    ) {
        super(input, context)
        this.mainEntityIds = input.map((val) => val.organizationId)
        this.output = { organizations: [] }
    }

    generateEntityMaps = async (
        input: AddUsersToOrganizationInput[]
    ): Promise<EntityMap<Organization>> =>
        generateMaps(this.mainEntityIds, input)

    protected async authorize(): Promise<void> {
        return this.context.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.send_invitation_40882
        )
    }

    protected validate = validateForAddRemove

    protected process = processForAddRemove

    protected buildOutput = (currentEntity: Organization): void => {
        this.output.organizations.push(
            mapOrganizationToOrganizationConnectionNode(currentEntity)
        )
    }
}

async function generateMaps(
    organizationIds: string[],
    input: AddUsersToOrganizationInput[]
) {
    const preloadedOrgArray = Organization.findByIds(organizationIds, {
        where: { status: Status.ACTIVE },
    })
    const preloadedRoleArray = Role.findByIds(
        input.map((val) => val.organizationRoleIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedUserArray = User.findByIds(
        input.map((val) => val.userIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedMembershipArray = OrganizationMembership.find({
        where: {
            user_id: In(input.map((val) => val.userIds).flat()),
            organization_id: In(organizationIds),
            status: Status.ACTIVE,
        },
    })

    return {
        mainEntity: new Map(
            (await preloadedOrgArray).map((i) => [i.organization_id, i])
        ),
        roles: new Map((await preloadedRoleArray).map((i) => [i.role_id, i])),
        users: new Map((await preloadedUserArray).map((i) => [i.user_id, i])),
        memberships: new Map(
            (await preloadedMembershipArray).map((i) => [
                [i.organization_id, i.user_id].toString(),
                i,
            ])
        ),
    }
}

function validateForAddRemove(
    index: number,
    currentEntity: Organization,
    currentInput: AddUsersToOrganizationInput,
    maps: EntityMap<Organization>
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
        }
        if (!user) continue
        // Membership validation
        if (maps.memberships.has([organizationId, userId].toString())) {
            errors.push(
                new APIError({
                    code: customErrors.duplicate_child_entity.code,
                    message: customErrors.duplicate_child_entity.message,
                    variables: ['organization_id', 'user_id'],
                    entity: 'User',
                    entityName: user.username,
                    parentEntity: 'OrganizationMembership in Organization',
                    parentName: currentEntity.organization_name,
                    index,
                })
            )
        }
    }
    return errors
}

function processForAddRemove(
    currentEntity: Organization,
    currentInput: AddUsersToOrganizationInput,
    maps: EntityMap<Organization>
): OrganizationMembership[] {
    // Retrieval
    const { organizationId, organizationRoleIds, userIds } = currentInput
    const roles = organizationRoleIds.map((ori) => maps.roles.get(ori) as Role)
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
    return memberships
}
