import { getManager, In, WhereExpression } from 'typeorm'
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
import {
    APIError,
    APIErrorCollection,
    validateAPICall,
} from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import {
    AddOrganizationRolesToUserInput,
    RemoveOrganizationRolesFromUserInput,
    UpdateUserInput,
    UsersMutationResult,
} from '../types/graphQL/user'
import { Brackets, EntityManager, getConnection } from 'typeorm'
import { UserContactInfo, CreateUserInput } from '../types/graphQL/user'
import { v4 as uuid_v4 } from 'uuid'
import { UserConnectionNode } from '../types/graphQL/user'
import {
    createUserSchema,
    updateUserSchema,
} from '../utils/mutations/validations/user'
import clean from '../utils/clean'
import {
    createInputLengthAPIError,
    createUnauthorizedAPIError,
} from '../utils/resolvers'
import { config } from '../config/config'

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
    if (args.input.length === 0) throw createInputLengthAPIError('User', 'min')
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        throw createInputLengthAPIError('User', 'max')
    await permissions.rejectIfNotAllowed(
        { organization_ids: args.input.map((i) => i.organizationId) },
        PermissionName.edit_users_40330
    )

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
        if (missingRoleIds.length) {
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
        }

        // User validation
        const user = preloadedUsers.get(userId)
        if (!user) {
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
        }

        // Organization validation
        const org = preloadedOrganizations.get(organizationId)
        if (!org) {
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

        // Organization Membership validation
        if (!org || !user) continue
        const dbMembership = preloadedMemberships.get(
            [organizationId, userId].toString()
        )
        if (!dbMembership) {
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
        }

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

// Uses the same "clean.xxxx()" calls as the csv functions do
function cleanCreateUserInput(cui: CreateUserInput): CreateUserInput {
    const ci: UserContactInfo = {
        email: clean.email(cui.contactInfo.email),
        phone: clean.phone(cui.contactInfo.phone),
    }
    const cleanCui: CreateUserInput = {
        givenName: cui.givenName,
        familyName: cui.familyName,
        contactInfo: ci,
        gender: cui.gender,
        username: cui.username,
        dateOfBirth: clean.dateOfBirth(cui.dateOfBirth),
        alternateEmail: clean.email(cui.alternateEmail),
        alternatePhone: clean.phone(cui.alternatePhone),
    }
    return cleanCui
}

// We check the entire input array in the database in ONE query to find if any of the input records that we are intending to submit
// already exist in the database.
// Note: The query, though in separate "OrWhere" clauses, is ONE query and the varable name contexts share
//       a namespace in the same query map. Thus a distinguishing value is added to the names of the variables passed to the
//       query so that they don't overwrite one another. In this case that distinguishing value is the index in the incoming
//       array of input values.
// Note: The above does mean we have to create an object of the type "Record<string,string|undefined|null>" take the different names, hence the eslint disable stuff
async function checkForExistingUsers(
    manager: EntityManager,
    inputs: CreateUserInput[]
): Promise<APIError[]> {
    const scope = manager.createQueryBuilder(User, 'User')

    for (let i = 0, len = inputs.length; i < len; i++) {
        const cui = inputs[i]
        buildUserPersonalInfoScope(
            scope,
            i,
            cui.givenName,
            cui.familyName,
            cui.contactInfo.email,
            cui.contactInfo.phone
        )
    }
    const existingUsers = await scope.getMany()
    const existingUserErrors = buildListOfExistingUserErrors(
        inputs,
        existingUsers
    )
    return existingUserErrors
}

// The search has returned a list of User records that the database has found that already exist.
// We create a map of the normalized inputs, and look up keys from those User records to find where in the
// input array they occur. We sort the resulting list as there is no guarentee that it will be in any order
// from the db, and ascending order will make more sense to the consumer of the error list rather than unordered.
function getIndicesOfExistingUsers(
    inputs: CreateUserInput[],
    users: User[]
): number[] {
    const inputMap = new Map(
        inputs.map((v, i) => [
            makeLookupKey(
                v.givenName,
                v.familyName,
                v.contactInfo.email ? v.contactInfo.email : v.contactInfo.phone
            ),
            i,
        ])
    )

    const results: number[] = []
    for (const user of users) {
        const userKey = makeLookupKey(
            user.given_name,
            user.family_name,
            user.email ? user.email : user.phone
        )
        const index = inputMap.get(userKey)
        if (index != undefined) {
            results.push(index)
        }
    }
    results.sort(function (a, b) {
        return a - b
    })
    return results
}

// Build a list of existing user errors that say in which index in the input
// the existing user is referenced.
function buildListOfExistingUserErrors(
    inputs: CreateUserInput[],
    existingUsers: User[]
): APIError[] {
    const errs: APIError[] = []
    if (existingUsers.length === 0) {
        return errs
    }
    const indices = getIndicesOfExistingUsers(inputs, existingUsers)
    for (const index of indices) {
        const input = inputs[index]
        const key = makeLookupKey(
            input.givenName,
            input.familyName,
            input.contactInfo.email
                ? input.contactInfo.email
                : input.contactInfo.phone
        )
        errs.push(
            new APIError({
                code: customErrors.duplicate_entity.code,
                message: customErrors.duplicate_entity.message,
                variables: [
                    'givenName',
                    'familyName',
                    `${input.contactInfo.email ? 'email' : 'phone'}`,
                ],
                entity: 'User',
                attribute: '',
                otherAttribute: `${keyToPrintableString(key)}`,
                index: index,
            })
        )
    }
    return errs
}

// We build a key for a map, I am using maps to reduce the looping through arrays to
// a minumum when looking up values
function makeLookupKey(
    given: string | undefined | null,
    family: string | undefined | null,
    contact: string | undefined | null
): string {
    const jsonKey = {
        contactInfo: contact,
        givenName: given,
        familyName: family,
    }
    return JSON.stringify(jsonKey)
}

function keyToPrintableString(key: string): string {
    const jsonKey = JSON.parse(key)
    const given = jsonKey['givenName']
    const family = jsonKey['familyName']
    const contact = jsonKey['contactInfo']

    return `${given},${family},${contact}`
}

// In addition to validation we create a map of the input values and look up the subsequent inputs
// in that map to catch duplicate entries
function checkCreateUserInput(inputs: CreateUserInput[]): APIError[] {
    const inputMap = new Map<string, number>()
    const errs: APIError[] = []
    for (let i = 0, len = inputs.length; i < len; i++) {
        const createUserInput = inputs[i]
        const { errors } = validateAPICall(createUserInput, createUserSchema, {
            entity: 'User',
        })
        if (errors.length > 0) {
            for (const e of errors) {
                e.index = i
            }
            errs.push(...errors)
        }
        const key = makeLookupKey(
            createUserInput.givenName,
            createUserInput.familyName,
            createUserInput.contactInfo.email
                ? createUserInput.contactInfo.email
                : createUserInput.contactInfo.phone
        )
        if (inputMap.has(key)) {
            errs.push(
                new APIError({
                    code: customErrors.duplicate_input_value.code,
                    message: customErrors.duplicate_input_value.message,
                    variables: [
                        'givenName',
                        'familyName',
                        `${
                            createUserInput.contactInfo.email
                                ? 'email'
                                : 'phone'
                        }`,
                    ],
                    entity: 'User',
                    attribute: 'ID',
                    otherAttribute: `${keyToPrintableString(key)}`,
                    index: i,
                })
            )
        } else {
            inputMap.set(key, i)
        }
    }

    return errs
}

// Convenience function to generate Users from CreateUsrInputs
function buildListOfNewUsers(inputs: CreateUserInput[]): User[] {
    const newUsers: User[] = []
    for (const cui of inputs) {
        const newUser = new User()
        newUser.user_id = uuid_v4()
        newUser.given_name = cui.givenName
        newUser.family_name = cui.familyName
        newUser.email = cui.contactInfo.email
            ? cui.contactInfo.email
            : undefined
        newUser.phone = cui.contactInfo.phone
            ? cui.contactInfo.phone
            : undefined
        newUser.gender = cui.gender
        newUser.username = cui.username
        newUser.alternate_email = cui.alternateEmail
            ? cui.alternateEmail
            : undefined
        newUser.alternate_phone = cui.alternatePhone
            ? cui.alternatePhone
            : undefined
        newUsers.push(newUser)
    }
    return newUsers
}

export async function createUsers(
    args: { input: CreateUserInput[] },
    context: Pick<Context, 'permissions'>
): Promise<UsersMutationResult> {
    const connection = getConnection()
    const results: UserConnectionNode[] = []
    const inputs = args.input
    const errs: APIError[] = []

    const manager = connection.manager

    // The users that we are creating in createUsers() are not linked to any organization however, permissions
    // are organization based, so the user whose token is passed to createUsers() has has to have permissions in
    // at least one organization to create users, or that token user has to be a super admin.

    let createUserPerm = false
    try {
        context.permissions.rejectIfNotAdmin()
        createUserPerm = true
    } catch {
        const orgs = await context.permissions.orgMembershipsWithPermissions([
            PermissionName.create_users_40220,
        ])
        createUserPerm = orgs.length > 0
    }
    if (!createUserPerm) {
        errs.push(
            createUnauthorizedAPIError(
                'User',
                'userId',
                context.permissions.getUserId()
            )
        )
        throw errs
    }

    if (inputs.length === 0) errs.push(createInputLengthAPIError('User', 'min'))

    if (inputs.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        errs.push(createInputLengthAPIError('User', 'max'))

    if (errs.length > 0) throw errs

    const checkErrs = checkCreateUserInput(inputs)
    if (checkErrs.length > 0) errs.push(...checkErrs)

    const normalizedInputs = inputs.map((val) => cleanCreateUserInput(val))
    const existingUserErrors = await checkForExistingUsers(
        manager,
        normalizedInputs
    )
    if (existingUserErrors.length > 0) {
        errs.push(...existingUserErrors)
    }

    if (errs.length > 0) throw errs

    const newUsers = buildListOfNewUsers(normalizedInputs)

    await manager.save<User>(newUsers)

    newUsers.map((u) =>
        results.push(mapUserToUserConnectionNode(u) as UserConnectionNode)
    )

    const resultValue: UsersMutationResult = { users: results }

    return resultValue
}

// Convenience function to generate Users from UpdateUserInputs
function buildListOfUpdatedUsers(
    inputs: UpdateUserInput[],
    existingUserMap: Map<string, User>
): User[] {
    const updatedUsers: User[] = []
    for (const uui of inputs) {
        const updatedUser = existingUserMap.get(uui.id)
        if (updatedUser != undefined) {
            updatedUser.user_id = uui.id
            updatedUser.given_name = uui.givenName ?? undefined
            updatedUser.family_name = uui.familyName ?? undefined
            updatedUser.email = uui.email ?? undefined
            updatedUser.phone = uui.phone ?? undefined
            updatedUser.gender = uui.gender ?? undefined
            updatedUser.username = uui.username
            updatedUser.alternate_email = uui.alternateEmail ?? undefined
            updatedUser.alternate_phone = uui.alternatePhone ?? undefined
            updatedUser.avatar = uui.avatar ?? undefined
            updatedUsers.push(updatedUser)
        }
    }
    return updatedUsers
}

function cleanUpdateUserInput(uui: UpdateUserInput): UpdateUserInput {
    const cleanUui: UpdateUserInput = {
        id: uui.id,
        email: clean.email(uui.email) || undefined,
        phone: clean.phone(uui.phone) || undefined,
        givenName: uui.givenName,
        familyName: uui.familyName,
        gender: uui.gender,
        username: uui.username,
        dateOfBirth: clean.dateOfBirth(uui.dateOfBirth),
        alternateEmail: clean.email(uui.alternateEmail) || undefined,
        alternatePhone: clean.phone(uui.alternatePhone) || undefined,
        avatar: uui.avatar,
        primaryUser: uui.primaryUser,
    }
    return cleanUui
}

interface ConflictCheck {
    conflicts: User[]
    checklist: UpdateUserInput[]
}

function buildUserPersonalInfoScope(
    scope: WhereExpression,
    i: number,
    given?: string,
    family?: string,
    email?: string | null,
    phone?: string | null
): WhereExpression {
    const searchParameters: Record<string, string | undefined | null> = {}
    searchParameters[`given_name${i}`] = given
    searchParameters[`family_name${i}`] = family
    let whereStr: string
    if (email) {
        searchParameters[`email${i}`] = email
        whereStr = `User.email = :email${i} AND User.given_name = :given_name${i} AND User.family_name = :family_name${i}`
    } else {
        searchParameters[`phone${i}`] = phone
        whereStr = `User.phone = :phone${i} AND User.given_name = :given_name${i} AND User.family_name = :family_name${i}`
    }
    scope.orWhere(
        new Brackets((qb) => {
            qb.where(whereStr, searchParameters)
        })
    )
    return scope
}

async function checkForGivenNameFamilyNameContactInfoCollisions(
    existingUserMap: Map<string, User>,
    inputs: UpdateUserInput[],
    manager: EntityManager
): Promise<APIError[]> {
    const scope = manager.createQueryBuilder(User, 'User')
    const checkingInputs: UpdateUserInput[] = []
    const ids: string[] = []
    scope.andWhere(
        new Brackets((oqb) => {
            for (let i = 0, len = inputs.length; i < len; i++) {
                const uui = inputs[i]
                const id = uui.id

                const existingUser = existingUserMap.get(id)
                const given = uui.givenName ?? existingUser?.given_name
                const family = uui.familyName ?? existingUser?.family_name
                const email = uui.email ?? existingUser?.email
                const phone = uui.phone ?? existingUser?.phone

                checkingInputs.push({
                    id: id,
                    givenName: given,
                    familyName: family,
                    email: email,
                    phone: phone,
                })
                ids.push(id)

                buildUserPersonalInfoScope(oqb, i, given, family, email, phone)
            }
        })
    )
    scope.andWhere(
        new Brackets((qb) => {
            qb.where('User.user_id NOT IN (:...ids)', {
                ids: ids,
            }).andWhere('User.status = :status', { status: Status.ACTIVE })
        })
    )
    const errs: APIError[] = []
    const conflicts = await scope.getMany()
    if (conflicts.length > 0) {
        const conflictErrs = buildConflictsErrors({
            conflicts,
            checklist: checkingInputs,
        })
        if (conflictErrs.length > 0) {
            errs.push(...conflictErrs)
        }
    }
    return errs
}

function checkUpdateUserInputs(inputs: UpdateUserInput[]): APIError[] {
    const inputMap = new Map<string, number>()
    const inputPersonalInfoMap = new Map<string, number>()
    const errs: APIError[] = []
    for (let i = 0, len = inputs.length; i < len; i++) {
        const updateUserInput = inputs[i]
        const { errors } = validateAPICall(updateUserInput, updateUserSchema, {
            entity: 'User',
        })
        if (errors.length > 0) {
            for (const e of errors) {
                e.index = i
            }
            errs.push(...errors)
        }
        let idErr = false
        if (inputMap.has(updateUserInput.id)) {
            idErr = true
            errs.push(
                new APIError({
                    code: customErrors.duplicate_input_value.code,
                    message: customErrors.duplicate_input_value.message,
                    variables: ['givenName', 'familyName', `${'id'}`],
                    entity: 'User',
                    attribute: 'ID',
                    otherAttribute: `${updateUserInput.id}`,
                    index: i,
                })
            )
        } else {
            inputMap.set(updateUserInput.id, i)
        }
        const key = makeLookupKey(
            updateUserInput.givenName,
            updateUserInput.familyName,
            updateUserInput.email
                ? updateUserInput.email
                : updateUserInput.phone
        )
        if (inputPersonalInfoMap.has(key)) {
            if (!idErr) {
                errs.push(
                    new APIError({
                        code: customErrors.duplicate_input_value.code,
                        message: customErrors.duplicate_input_value.message,
                        variables: [
                            'givenName',
                            'familyName',
                            `${updateUserInput.email ? 'email' : 'phone'}`,
                        ],
                        entity: 'User',
                        attribute: 'ID',
                        otherAttribute: `${keyToPrintableString(key)}`,
                        index: i,
                    })
                )
            }
        } else {
            inputPersonalInfoMap.set(key, i)
        }
    }
    return errs
}

async function checkForUpdateExistingUsers(
    manager: EntityManager,
    inputs: UpdateUserInput[]
): Promise<User[]> {
    const ids = inputs.map((uui) => uui.id)
    const scope = manager
        .createQueryBuilder(User, 'User')
        .where('User.user_id IN (:...ids)', { ids })
        .andWhere('User.status = :status', { status: Status.ACTIVE })
    return await scope.getMany()
}

function buildConflictsErrors(conflictcheck: ConflictCheck): APIError[] {
    const conflictErrs: APIError[] = []
    const conflictsMap = new Map(
        conflictcheck.checklist.map((v, i) => [
            makeLookupKey(
                v.givenName,
                v.familyName,
                v.email ? v.email : v.phone
            ),
            i,
        ])
    )
    for (const u of conflictcheck.conflicts) {
        const ukey = makeLookupKey(
            u.given_name,
            u.family_name,
            u.email ? u.email : u.phone
        )
        if (conflictsMap.has(ukey)) {
            const index = conflictsMap.get(ukey)
            if (index != undefined) {
                const contactInfo =
                    conflictcheck.checklist[index].email != undefined
                        ? 'email'
                        : 'phone'
                const e = new APIError({
                    code: customErrors.duplicate_entity.code,
                    message: customErrors.duplicate_entity.message,
                    variables: ['givenName', 'familyName', `${contactInfo}`],
                    entity: 'User',
                    attribute: '',
                    otherAttribute: `${keyToPrintableString(ukey)}`,
                    index: index,
                })
                conflictErrs.push(e)
            }
        }
    }

    return conflictErrs
}

function buildListOfUpdateMissingUserErrors(
    missingIds: number[],
    inputs: UpdateUserInput[]
): APIError[] {
    const errs: APIError[] = []
    for (const index of missingIds) {
        const e = new APIError({
            code: customErrors.nonexistent_entity.code,
            message: customErrors.nonexistent_entity.message,
            variables: ['id'],
            entity: 'User',
            attribute: 'user_id',
            otherAttribute: `${inputs[index].id}`,
            index,
        })

        errs.push(e)
    }
    return errs
}

// We check that the incoming user ids already exist in the db
// we must not create new users with explicit ids.
function checkForMissingUpdateUsers(
    inputs: UpdateUserInput[],
    existingUsers: User[],
    existingUserMap: Map<string, User>
): APIError[] {
    let missingErrs: APIError[] = []
    if (existingUsers.length < inputs.length) {
        const missingIndexes: number[] = []
        for (let i = 0, len = inputs.length; i < len; i++) {
            if (!existingUserMap.has(inputs[i].id)) {
                missingIndexes.push(i)
            }
        }
        missingErrs = buildListOfUpdateMissingUserErrors(missingIndexes, inputs)
    }

    return missingErrs
}

export async function updateUsers(
    args: { input: UpdateUserInput[] },
    context: Pick<Context, 'permissions'>
): Promise<UsersMutationResult> {
    const connection = getConnection()
    const results: UserConnectionNode[] = []
    const inputs = args.input
    const errs: APIError[] = []
    const manager = connection.manager
    let updateUserPerm = false
    try {
        context.permissions.rejectIfNotAdmin()
        updateUserPerm = true
    } catch {
        const orgs = await context.permissions.orgMembershipsWithPermissions([
            PermissionName.edit_users_40330,
        ])
        updateUserPerm = orgs.length > 0
    }
    if (!updateUserPerm) {
        errs.push(
            createUnauthorizedAPIError(
                'User',
                'userId',
                context.permissions.getUserId()
            )
        )
        throw errs
    }
    if (inputs.length === 0) errs.push(createInputLengthAPIError('User', 'min'))

    if (inputs.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        errs.push(createInputLengthAPIError('User', 'max'))

    if (errs.length > 0) throw errs

    const checkErrs = checkUpdateUserInputs(inputs)
    if (checkErrs.length > 0) {
        errs.push(...checkErrs)
    }

    const normalizedInputs = inputs.map((val) => cleanUpdateUserInput(val))
    const existingUsers = await checkForUpdateExistingUsers(
        manager,
        normalizedInputs
    )
    const existingUserMap = new Map(existingUsers.map((v) => [v.user_id, v]))
    const missingUserErrors = checkForMissingUpdateUsers(
        normalizedInputs,
        existingUsers,
        existingUserMap
    )
    if (missingUserErrors.length > 0) {
        errs.push(...missingUserErrors)
    }

    const conflictErrs = await checkForGivenNameFamilyNameContactInfoCollisions(
        existingUserMap,
        normalizedInputs,
        manager
    )
    if (conflictErrs.length > 0) {
        errs.push(...conflictErrs)
    }

    if (errs.length > 0) throw errs

    const updatedUsers = buildListOfUpdatedUsers(
        normalizedInputs,
        existingUserMap
    )
    await manager.save<User>(updatedUsers)

    updatedUsers.map((u) =>
        results.push(mapUserToUserConnectionNode(u) as UserConnectionNode)
    )

    const resultValue: UsersMutationResult = { users: results }

    return resultValue
}
