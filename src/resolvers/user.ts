import { getManager, In } from 'typeorm'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { Status } from '../entities/status'
import { User } from '../entities/user'
import { Context } from '../main'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
} from '../pagination/usersConnection'
import { PermissionName } from '../permissions/permissionNames'
import { UserPermissions } from '../permissions/userPermissions'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import {
    AddOrganizationRolesToUserInput,
    RemoveOrganizationRolesFromUserInput,
    UsersMutationResult,
} from '../types/graphQL/user'

// TODO: Replace with static configuration solution
export const MAX_MUTATION_INPUT_ARRAY_SIZE = 50

export function addOrganizationRolesToUsers(
    args: { input: AddOrganizationRolesToUserInput[] },
    context: Pick<Context, 'permissions'>
): Promise<UsersMutationResult> {
    return modifyOrganizationRoles(
        args,
        context.permissions,
        (currentRoles: Role[], rolesToAdd: Role[]): Role[] => {
            currentRoles.push(...rolesToAdd)
            return [...new Set(currentRoles)]
        }
    )
}

export function removeOrganizationRolesFromUsers(
    args: { input: RemoveOrganizationRolesFromUserInput[] },
    context: Pick<Context, 'permissions'>
): Promise<{ users: CoreUserConnectionNode[] }> {
    return modifyOrganizationRoles(
        args,
        context.permissions,
        (currentRoles: Role[], rolesToRemove: Role[]): Role[] =>
            currentRoles.filter(
                (cr) => !rolesToRemove.find((rtr) => cr.role_id === rtr.role_id)
            )
    )
}

async function modifyOrganizationRoles(
    args: {
        input:
            | AddOrganizationRolesToUserInput[]
            | RemoveOrganizationRolesFromUserInput[]
    },
    permissions: UserPermissions,
    roleModificationFn: (currentRoles: Role[], roleChanges: Role[]) => Role[]
) {
    // Initial validations
    if (args.input.length === 0)
        throw new APIError({
            code: customErrors.invalid_array_min_length.code,
            message: customErrors.invalid_array_min_length.message,
            variables: [],
            entity: 'User',
            min: 1,
        })
    if (args.input.length > MAX_MUTATION_INPUT_ARRAY_SIZE)
        throw new APIError({
            code: customErrors.invalid_array_max_length.code,
            message: customErrors.invalid_array_max_length.message,
            variables: [],
            entity: 'User',
            max: MAX_MUTATION_INPUT_ARRAY_SIZE,
        })
    for (const val of args.input) {
        await permissions.rejectIfNotAllowed(
            { organization_id: val.organizationId },
            PermissionName.edit_users_40330
        )
    }

    // Preloading
    const preloadedUserArray = User.findByIds(
        args.input.map((val) => val.userId),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedRoleArray = Role.findByIds(
        args.input.map((val) => val.roleIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedOrganizationArray = Organization.findByIds(
        args.input.map((val) => val.organizationId),
        { where: { status: Status.ACTIVE } }
    )
    const preloadedMembershipArray = OrganizationMembership.find({
        where: {
            user_id: In(args.input.map((val) => val.userId)),
            organization_id: In(args.input.map((val) => val.organizationId)),
            status: Status.ACTIVE,
        },
        relations: ['roles'],
    })
    const preloadedRoles = new Map(
        (await preloadedRoleArray).map((i) => [i.role_id, i])
    )
    const preloadedUsers = new Map(
        (await preloadedUserArray).map((i) => [i.user_id, i])
    )
    const preloadedOrganizations = new Map(
        (await preloadedOrganizationArray).map((i) => [i.organization_id, i])
    )
    const preloadedMemberships = new Map(
        (await preloadedMembershipArray).map((i) => [
            [i.organization_id, i.user_id].toString(),
            i,
        ])
    )

    // Process inputs
    const errors: APIError[] = []
    const memberships: OrganizationMembership[] = []
    const output: CoreUserConnectionNode[] = []
    for (const [index, subArgs] of args.input.entries()) {
        // Organization validation
        const { organizationId, userId, roleIds } = subArgs

        // Role validation
        const roles: Role[] = []
        const missingRoleIds: string[] = []
        for (const roleId of roleIds) {
            const role = preloadedRoles.get(roleId)
            if (role) roles.push(role)
            else missingRoleIds.push(roleId)
        }
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

        // User validation
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

        // Organization validation
        const org = preloadedOrganizations.get(organizationId)
        if (!org)
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

        // Organization Membership validation
        if (!org || !user) continue
        const dbMembership = preloadedMemberships.get(
            [organizationId, userId].toString()
        )
        if (!dbMembership)
            errors.push(
                new APIError({
                    code: customErrors.nonexistent_child.code,
                    message: customErrors.nonexistent_child.message,
                    variables: ['organization_id', 'user_id'],
                    entity: 'User',
                    entityName: user?.user_name() || userId,
                    parentEntity: 'OrganizationMembership in Organization',
                    parentName: org?.organization_name || organizationId,
                    index,
                })
            )

        // Add/remove roles in organization membership
        if (errors.length > 0 || !dbMembership) continue
        const dbMembershipRoles = (await dbMembership.roles) || [] // should already be fetched
        dbMembership.roles = Promise.resolve(
            roleModificationFn(dbMembershipRoles, roles)
        )
        memberships.push(dbMembership)

        // Build output
        output.push(mapUserToUserConnectionNode(user))
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

    return { users: output }
}
