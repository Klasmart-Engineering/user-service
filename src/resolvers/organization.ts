import { getManager, In } from 'typeorm'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { Status } from '../entities/status'
import { User } from '../entities/user'
import { Context } from '../main'
import { mapOrganizationToOrganizationConnectionNode } from '../pagination/organizationsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import {
    AddUsersToOrganizationInput,
    OrganizationConnectionNode,
    OrganizationsMutationResult,
} from '../types/graphQL/organization'
import { createInputLengthAPIError } from '../utils/resolvers'
import { config } from '../config/config'
import { generateShortCode, validateShortCode } from '../utils/shortcode'

export async function addUsersToOrganizations(
    args: { input: AddUsersToOrganizationInput[] },
    context: Pick<Context, 'permissions'>
): Promise<OrganizationsMutationResult> {
    // Initial validations
    if (args.input.length === 0)
        throw createInputLengthAPIError('Organization', 'min')
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        throw createInputLengthAPIError('Organization', 'max')
    for (const val of args.input) {
        await context.permissions.rejectIfNotAllowed(
            { organization_id: val.organizationId },
            PermissionName.send_invitation_40882
        )
    }

    // Preloading
    const preloadedOrgArray = Organization.findByIds(
        args.input.map((val) => val.organizationId),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedRoleArray = Role.findByIds(
        args.input.map((val) => val.organizationRoleIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedUserArray = User.findByIds(
        args.input.map((val) => val.userIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedMembershipArray = OrganizationMembership.find({
        where: {
            user_id: In(args.input.map((val) => val.userIds).flat()),
            organization_id: In(args.input.map((val) => val.organizationId)),
            status: Status.ACTIVE,
        },
    })
    const preloadedOrgs = new Map(
        (await preloadedOrgArray).map((i) => [i.organization_id, i])
    )
    const preloadedRoles = new Map(
        (await preloadedRoleArray).map((i) => [i.role_id, i])
    )
    const preloadedUsers = new Map(
        (await preloadedUserArray).map((i) => [i.user_id, i])
    )
    const preloadedMemberships = new Map(
        (await preloadedMembershipArray).map((i) => [
            [i.organization_id, i.user_id].toString(),
            i,
        ])
    )

    // Process inputs
    const memberships: OrganizationMembership[] = []
    const output: OrganizationConnectionNode[] = []
    const errors: APIError[] = []
    for (const [index, subArgs] of args.input.entries()) {
        // Organization validation
        const { organizationId, organizationRoleIds, userIds } = subArgs
        let { shortcode } = subArgs

        const organization = preloadedOrgs.get(organizationId)
        if (!organization) {
            errors.push(
                new APIError({
                    code: customErrors.nonexistent_or_inactive.code,
                    message: customErrors.nonexistent_or_inactive.message,
                    variables: ['organization_id'],
                    entity: 'Organization',
                    attribute: 'ID',
                    otherAttribute: organizationId,
                    index,
                })
            )
        }

        // Shortcode validation
        if (organization) {
            if (shortcode) shortcode = shortcode.toUpperCase()
            shortcode = validateShortCode(
                shortcode,
                config.limits.SHORTCODE_MAX_LENGTH
            )
                ? shortcode
                : undefined
        }

        // Role validation
        const roles: Role[] = []
        const missingRoleIds: string[] = []
        organizationRoleIds.forEach((val) => {
            const role = preloadedRoles.get(val)
            if (role) roles.push(role)
            else missingRoleIds.push(val)
        })
        if (missingRoleIds.length)
            errors.push(
                new APIError({
                    code: customErrors.nonexistent_or_inactive.code,
                    message: customErrors.nonexistent_or_inactive.message,
                    variables: ['role_id'],
                    entity: 'Role',
                    attribute: 'IDs',
                    otherAttribute: missingRoleIds.toString(),
                    index,
                })
            )

        // Create org memberships for each user, including all roles
        for (const userId of userIds) {
            const user = preloadedUsers.get(userId)
            if (!user)
                errors.push(
                    new APIError({
                        code: customErrors.nonexistent_or_inactive.code,
                        message: customErrors.nonexistent_or_inactive.message,
                        variables: ['user_id'],
                        entity: 'User',
                        attribute: 'ID',
                        otherAttribute: userId,
                        index,
                    })
                )

            if (!organization || !user) continue
            if (preloadedMemberships.has([organizationId, userId].toString())) {
                errors.push(
                    new APIError({
                        code: customErrors.duplicate_child_entity.code,
                        message: customErrors.duplicate_child_entity.message,
                        variables: ['organization_id', 'user_id'],
                        entity: 'User',
                        entityName: user.username,
                        parentEntity: 'OrganizationMembership in Organization',
                        parentName: organization.organization_name,
                        index,
                    })
                )
            }

            if (errors.length > 0) continue
            const membership = new OrganizationMembership()
            membership.organization_id = organizationId
            membership.roles = Promise.resolve(roles)
            membership.organization = Promise.resolve(organization)
            membership.user_id = userId
            membership.user = Promise.resolve(user)
            membership.shortcode =
                shortcode ||
                generateShortCode(userId, config.limits.SHORTCODE_MAX_LENGTH)
            memberships.push(membership)
        }

        // Build output
        if (errors.length > 0 || !organization) continue
        output.push(mapOrganizationToOrganizationConnectionNode(organization))
    }

    if (errors.length > 0) throw new APIErrorCollection(errors)
    try {
        await getManager().save(memberships)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'User',
        })
    }
    return { organizations: output }
}
