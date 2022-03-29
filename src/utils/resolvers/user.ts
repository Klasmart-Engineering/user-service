import { getManager, In } from 'typeorm'
import { Organization } from '../../entities/organization'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { Role } from '../../entities/role'
import { User } from '../../entities/user'
import { PermissionName } from '../../permissions/permissionNames'
import { UserPermissions } from '../../permissions/userPermissions'
import {
    AddOrganizationRolesToUsersEntityMap,
    RemoveOrganizationRolesFromUsersEntityMap,
} from '../../resolvers/user'
import { APIError } from '../../types/errors/apiError'
import {
    AddOrganizationRolesToUserInput,
    CreateUserInput,
    RemoveOrganizationRolesFromUserInput,
    UpdateUserInput,
    UserContactInfo,
} from '../../types/graphQL/user'
import clean from '../clean'
import {
    filterInvalidInputs,
    ProcessedResult,
    validateNoDuplicateAttribute,
    validateSubItemsLengthAndNoDuplicates,
} from '../mutations/commonStructure'
import { ObjMap } from '../stringUtils'
import { getMap } from './entityMaps'
import {
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
} from './inputValidation'

export type ConflictingUserKey = {
    givenName?: string
    familyName?: string
    username?: string
    email?: string
    phone?: string
}

export type OrganizationMembershipKey = {
    organizationId: string
    userId: string
}

export type AddRemoveInputTypeName =
    | 'AddOrganizationRolesToUsersInput'
    | 'RemoveOrganizationRolesFromUserInput'

/**
 * Transforms the given CreateUserInput in a ConflictingUserKey
 */
export function createUserInputToConflictingUserKey(
    input: CreateUserInput
): ConflictingUserKey {
    const { givenName, familyName, username, contactInfo } = input
    return {
        givenName,
        familyName,
        username: username || undefined,
        email: contactInfo?.email || undefined,
        phone: contactInfo?.phone || undefined,
    }
}

/**
 * Transforms the given UpdateUserInput in a ConflictingUserKey
 */
export function updateUserInputToConflictingUserKey(
    input: UpdateUserInput,
    usersMap: Map<string, User>
): ConflictingUserKey {
    const { id, givenName, familyName, username, email, phone } = input
    const user = usersMap.get(id)
    return {
        givenName: givenName || user?.given_name,
        familyName: familyName || user?.family_name,
        username: username || user?.username,
        email: email || user?.email,
        phone: phone || user?.phone,
    }
}

/**
 * Builds a ConflictingUserKey taking the transformed CreateUserInput.
 * This key is built taking givenName, familyName and the first existing value of the following fields in that order: (username, email, phone)
 */
export function buildConflictingUserKey(
    inputValues: ConflictingUserKey
): ConflictingUserKey {
    const { givenName, familyName, username, email, phone } = inputValues
    const key = {
        givenName,
        familyName,
        ...addIdentifierToKey(username, email, phone),
    }

    return key
}

/**
 * Returns in an Object like format the first value found between (username, email, phone)
 */
export function addIdentifierToKey(
    username?: string,
    email?: string,
    phone?: string
) {
    if (username) return { username }
    else if (email) return { email }
    else if (phone) return { phone }
}

/**
 * Uses the same "clean.xxxx()" calls as the csv functions do
 */
export function cleanCreateUserInput(cui: CreateUserInput): CreateUserInput {
    const ci: UserContactInfo | undefined = cui.contactInfo
        ? {
              email: clean.email(cui.contactInfo.email),
              // don't throw errors as they will of already been
              // found by validation but this code runs before we return them
              phone: clean.phone(cui.contactInfo.phone, false),
          }
        : undefined

    const cleanCui: CreateUserInput = {
        givenName: cui.givenName,
        familyName: cui.familyName,
        contactInfo: ci,
        gender: cui.gender,
        dateOfBirth: clean.dateOfBirth(cui.dateOfBirth),
        username: cui.username,
        alternateEmail: clean.email(cui.alternateEmail),
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
        alternatePhone: clean.phone(cui.alternatePhone, false),
    }
    return cleanCui
}

/**
 * Normalizes and clean the input fields using the "clean.xxxx()" calls
 */
export function cleanUpdateUserInput(uui: UpdateUserInput): UpdateUserInput {
    const cleanUui: UpdateUserInput = {
        id: uui.id,
        email: clean.email(uui.email) || undefined,
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
        phone: clean.phone(uui.phone, false) || undefined,
        givenName: uui.givenName,
        familyName: uui.familyName,
        gender: uui.gender,
        username: uui.username,
        dateOfBirth: clean.dateOfBirth(uui.dateOfBirth),
        alternateEmail: clean.email(uui.alternateEmail) || undefined,
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
        alternatePhone: clean.phone(uui.alternatePhone, false) || undefined,
        avatar: uui.avatar,
        primaryUser: uui.primaryUser,
    }
    return cleanUui
}

export async function generateEntityMapsForAddRemoveOrgRoles(
    inputTypeName: AddRemoveInputTypeName,
    input:
        | AddOrganizationRolesToUserInput[]
        | RemoveOrganizationRolesFromUserInput[]
) {
    let organizationIds: string[] = []
    let roleIds: string[] = []
    let userIds: string[] = []

    input.forEach((i) => {
        organizationIds.push(i.organizationId)
        roleIds.push(...i.roleIds)
        userIds.push(i.userId)
    })

    organizationIds = [...new Set(organizationIds)]
    roleIds = [...new Set(roleIds)]
    userIds = [...new Set(userIds)]

    const userMap = getMap.user(userIds)
    const roleMap = getMap.role(roleIds, ['organization'])
    const organizationMap = await getMap.organization(organizationIds)
    const organizationMapKeys = [...organizationMap.keys()]
    const orgRoles = new Map<string, Role[]>(
        Array.from(organizationMapKeys, (k) => [k, []])
    )

    if (inputTypeName === 'AddOrganizationRolesToUsersInput') {
        const allRolesFromOrgs = await Role.find({
            // don't query system roles, as these are valid for all organizations anyway
            where: {
                system_role: false,
                organization: {
                    organization_id: In(organizationMapKeys),
                },
            },
            join: {
                alias: 'Role',
                leftJoinAndSelect: {
                    organization: 'Role.organization',
                },
            },
        })

        const rolesOrgs = await Promise.all(
            allRolesFromOrgs.map((r) => r.organization!)
        )

        for (const [i, role] of allRolesFromOrgs.entries()) {
            const roleOrgId = rolesOrgs[i].organization_id
            const roles = orgRoles.get(roleOrgId) ?? []
            roles.push(role)
            orgRoles.set(roleOrgId, roles)
        }
    }

    const membershipMap = await getMap.membership.organization(
        organizationIds,
        userIds,
        ['roles']
    )

    // Make map for memberships' roles (does not need to query db)
    const membershipRoles = new ObjMap<OrganizationMembershipKey, Role[]>()
    for (const [key, membership] of membershipMap.entries()) {
        if (membership.roles) {
            // eslint-disable-next-line no-await-in-loop
            membershipRoles.set(key, await membership.roles)
        }
    }

    return {
        mainEntity: await userMap,
        organizations: organizationMap,
        roles: await roleMap,
        memberships: membershipMap,
        membershipRoles,
        orgRoles,
    }
}

export async function authorizeForAddRemoveOrgRoles(
    input:
        | AddOrganizationRolesToUserInput[]
        | RemoveOrganizationRolesFromUserInput[],
    permissions: UserPermissions
) {
    const organizationIds = input.map((i) => i.organizationId)
    return permissions.rejectIfNotAllowed(
        { organization_ids: organizationIds },
        PermissionName.edit_users_40330
    )
}

export function validationOverAllInputsForAddRemoveOrgRoles(
    inputTypeName: AddRemoveInputTypeName,
    inputs:
        | AddOrganizationRolesToUserInput[]
        | RemoveOrganizationRolesFromUserInput[]
) {
    const failedDuplicateUsers = validateNoDuplicateAttribute(
        inputs.map((i) => {
            return { entityId: i.organizationId, attributeValue: i.userId }
        }),
        'Organization',
        'userId'
    )

    const failedRoles = validateSubItemsLengthAndNoDuplicates(
        inputs,
        inputTypeName,
        'roleIds'
    )

    return filterInvalidInputs(inputs, [failedDuplicateUsers, ...failedRoles])
}

export function validateForAddRemoveOrgRoles(
    inputTypeName: AddRemoveInputTypeName,
    index: number,
    currentInput:
        | AddOrganizationRolesToUserInput
        | RemoveOrganizationRolesFromUserInput,
    maps:
        | AddOrganizationRolesToUsersEntityMap
        | RemoveOrganizationRolesFromUsersEntityMap
) {
    const { userId, organizationId, roleIds } = currentInput
    const errors: APIError[] = []

    const orgs = flagNonExistent(
        Organization,
        index,
        [organizationId],
        maps.organizations
    )

    const users = flagNonExistent(User, index, [userId], maps.mainEntity)
    const roles = flagNonExistent(Role, index, roleIds, maps.roles)
    errors.push(...orgs.errors, ...users.errors, ...roles.errors)

    if (users.errors.length || orgs.errors.length) return errors

    const memberships = flagNonExistentOrganizationMembership(
        index,
        organizationId,
        [userId],
        maps.memberships
    )

    errors.push(...memberships.errors)

    if (memberships.errors.length) return errors

    const roleChildMethod =
        inputTypeName === 'AddOrganizationRolesToUsersInput'
            ? flagExistentChild
            : flagNonExistentChild

    const existingRoles = maps.membershipRoles.get({
        organizationId,
        userId,
    })!

    const roleInMembershipErrors = roleChildMethod(
        Organization,
        Role,
        index,
        organizationId,
        roles.values.map((r) => r.role_id),
        new Set(existingRoles.map((r) => r.role_id))
    )

    errors.push(...roleInMembershipErrors)

    if (inputTypeName === 'AddOrganizationRolesToUsersInput') {
        const mapsToAdd = maps as AddOrganizationRolesToUsersEntityMap
        const orgRoles = mapsToAdd.orgRoles.get(organizationId)!
        const roleInOrgErrors = flagNonExistentChild(
            Organization,
            Role,
            index,
            organizationId,
            roles.values.filter((r) => !r.system_role).map((r) => r.role_id),
            new Set(orgRoles.map((r) => r.role_id))
        )

        errors.push(...roleInOrgErrors)
    }

    return errors
}

export function processForAddRemoveOrgRoles(
    inputTypeName: AddRemoveInputTypeName,
    mainEntityIds: string[],
    currentInput:
        | AddOrganizationRolesToUserInput
        | RemoveOrganizationRolesFromUserInput,
    maps:
        | AddOrganizationRolesToUsersEntityMap
        | RemoveOrganizationRolesFromUsersEntityMap,
    index: number
) {
    const currentEntity = maps.mainEntity.get(mainEntityIds[index])!
    const { userId, organizationId, roleIds } = currentInput
    const dbMembership = maps.memberships.get({ organizationId, userId })!
    const dbMembershipRoles = maps.membershipRoles.get({
        organizationId,
        userId,
    })!

    if (inputTypeName === 'AddOrganizationRolesToUsersInput') {
        dbMembership.roles = Promise.resolve([
            ...dbMembershipRoles,
            ...roleIds.map((rId) => maps.roles.get(rId)!),
        ])
    } else {
        const roleIdsSet = new Set(roleIds)
        dbMembership.roles = Promise.resolve(
            dbMembershipRoles.filter((dmr) => !roleIdsSet.has(dmr.role_id))
        )
    }

    return { outputEntity: currentEntity, modifiedEntity: [dbMembership] }
}

export async function applyToDatabaseForAddRemoveOrgRoles(
    results: ProcessedResult<User, OrganizationMembership>[]
) {
    const saveEntities = results
        .flatMap((r) => r.modifiedEntity)
        .filter((r): r is OrganizationMembership => r !== undefined)

    await getManager().save(saveEntities)
}
