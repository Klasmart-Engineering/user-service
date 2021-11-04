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
import { Brackets, EntityManager, getConnection } from 'typeorm'
import { ContactInfoInput, CreateUserInput } from '../types/graphQL/input/user'
import { v4 as uuid_v4 } from 'uuid'
import { UserConnectionNode } from '../types/graphQL/user'
import {
    createUserSchema,
    createUserSchemaMetadata,
} from '../utils/mutations/validations/user'
import clean from '../utils/clean'


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

// Uses the same "clean.xxxx()" calls as the csv functions do
function cleanCreateUserInput(cui: CreateUserInput): CreateUserInput {
    const ci: ContactInfoInput = {
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
// Note: The above does mean we have to create an object of the type "any" take the different names, hence the eslint disable stuff
async function checkForExistingUsers(
    manager: EntityManager,
    inputs: CreateUserInput[]
): Promise<User[]> {
    const scope = manager.createQueryBuilder(User, 'User')

    for (const i in inputs) {
        const cui = inputs[i]
        if (cui.contactInfo.email) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const searchParameters: any = {}
            searchParameters[`email${i}`] = cui.contactInfo.email
            searchParameters[`given_name${i}`] = cui.givenName
            searchParameters[`family_name${i}`] = cui.familyName
            scope.orWhere(
                new Brackets((qb) => {
                    qb.where(
                        `User.email = :email${i} AND User.given_name = :given_name${i} AND User.family_name = :family_name${i}`,
                        searchParameters
                    )
                })
            )
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const searchParameters: any = {}
            searchParameters[`phone${i}`] = cui.contactInfo.phone
            searchParameters[`given_name${i}`] = cui.givenName
            searchParameters[`family_name${i}`] = cui.familyName
            scope.orWhere(
                new Brackets((qb) => {
                    qb.where(
                        `User.phone = :phone${i} AND User.given_name = :given_name${i} AND User.family_name = :family_name${i}`,
                        searchParameters
                    )
                })
            )
        }
    }
    return await scope.getMany()
}

// The search has returned a list of User records that the database has found that already exist.
// We create a map of the normalized inputs, and look up keys from those User records to find where in the
// input array they occur. We sort the resulting list as there is no guarentee that it will be in any order
// from the db, and ascending order will make more sense to the consumer of the error list rather than unordered.
function getIndicesOfExistingUsers(
    inputs: CreateUserInput[],
    users: User[]
): number[] {
    const inputMap = new Map(inputs.map((v, i) => [makeInputKey(v), i]))

    const results: number[] = []
    for (const user of users) {
        const userKey = makeUserKey(user)
        if (inputMap.has(userKey)) {
            const index = inputMap.get(userKey)
            if (index != undefined) {
                results.push(index)
            }
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
    const indices = getIndicesOfExistingUsers(inputs, existingUsers)
    for (const index of indices) {
        const key = makeInputKey(inputs[index])
        errs.push(
            new APIError({
                code: customErrors.duplicate_entity.code,
                message: customErrors.duplicate_entity.message,
                variables: [
                    'givenName',
                    'familyName',
                    `${inputs[index].contactInfo.email ? 'email' : 'phone'}`,
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

// This character: Unicode 0001, is a control character unlikely to occur in a string
// is used a divider between parts of a key made of separate string attributes
const ctlA = String.fromCharCode(1)

// We build a key for a map, I am using maps to reduce the looping through arrays to
// a minumum when looking up values
function makeInputKey(input: CreateUserInput): string {
    const contactInfo = input.contactInfo.email
        ? input.contactInfo.email
        : input.contactInfo.phone
    return `${input.givenName}${ctlA}${input.familyName}${ctlA}${contactInfo}`
}

function makeUserKey(user: User): string {
    const contactInfo = user.email ? user.email : user.phone
    return `${user.given_name}${ctlA}${user.family_name}${ctlA}${contactInfo}`
}

function keyToPrintableString(key: string): string {
    // eslint-disable-next-line no-control-regex
    const re = new RegExp(ctlA, 'g')

    return key.replace(re, ',')
}

// In addition to validation we create a map of the input values and look up the subsequent inputs
// in that map to catch duplicate entries
function checkCreateUserInput(inputs: CreateUserInput[]): APIError[] {
    const inputMap = new Map<string, number>()
    const errs: APIError[] = []
    for (let i = 0, len = inputs.length; i < len; i++) {
        const createUserInput = inputs[i]
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { errors, validData } = validateAPICall(
            createUserInput,
            createUserSchema,
            createUserSchemaMetadata
        )
        if (errors.length > 0) {
            for (const e of errors) {
                e.index = i
            }
            errs.push(...errors)
        }
        const key = makeInputKey(createUserInput)
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

// TO DO: Replace with static configuration solution
export const MAX_MUTATION_INPUT_ARRAY_SIZE = 50

export async function createUsers(
    args: { input: CreateUserInput[] },
    context: Context
): Promise<UsersMutationResult> {
    const connection = getConnection()
    const results: UserConnectionNode[] = []
    const inputs = args.input
    const errs: APIError[] = []
    try {
        const manager = connection.manager

        // The users that we are creating in createUsers() are not linked to any organization however, permissions
        // are organization based, so the user whose token is passed to createUsers() has has to have permissions in
        // at least one organization to create users, or that token user has to be a super admin.

        // I strongly suggest that the API call that createUsers() is replacing model.newUser() be altered to use this
        // call while it is deprecated, before it is finally removed from the API.

        const createUserPerm = await context.permissions.checkForPermInAnyOrg(
            manager,
            PermissionName.create_users_40220
        )

        if (!createUserPerm) {
            errs.push(
                new APIError({
                    code: customErrors.unauthorized.code,
                    message: customErrors.unauthorized.message,
                    variables: [],
                    entity: 'User',
                    attribute: 'ID',
                })
            )

            throw errs
        }

        if (inputs.length === 0) {
            errs.push(
                new APIError({
                    code: customErrors.invalid_array_min_length.code,
                    message: customErrors.invalid_array_min_length.message,
                    variables: [],
                    entity: 'User',
                })
            )
            throw errs
        }

        // Question : is this the correct placement or should it go first?
        if (inputs.length > MAX_MUTATION_INPUT_ARRAY_SIZE) {
            errs.push(
                new APIError({
                    code: customErrors.invalid_array_max_length.code,
                    message: customErrors.invalid_array_max_length.message,
                    variables: [],
                    entity: 'User',
                })
            )
            throw errs
        }

        const checkErrs = checkCreateUserInput(inputs)
        if (checkErrs.length > 0) {
            errs.push(...checkErrs)
        }

        if (errs.length > 0) {
            throw errs
        }

        const normalizedInputs = inputs.map((val) => cleanCreateUserInput(val))
        const existingUsers = await checkForExistingUsers(
            manager,
            normalizedInputs
        )

        if (existingUsers && existingUsers.length > 0) {
            const existingUserErrors = buildListOfExistingUserErrors(
                normalizedInputs,
                existingUsers
            )
            if (existingUserErrors.length > 0) {
                errs.push(...existingUserErrors)
                throw errs
            }
        }

        const newUsers = buildListOfNewUsers(normalizedInputs)

        try {
            await manager.save<User>(newUsers)
        } catch (error: unknown) {
            let mess = 'Unknown error'

            if (typeof error === 'string') {
                mess = error
            } else {
                if (error instanceof Error) {
                    mess = error.message
                }
            }

            errs.push(
                new APIError({
                    code: customErrors.database_save_error.code,
                    message: customErrors.database_save_error.message,
                    variables: [mess],
                    entity: 'User',
                })
            )
            throw errs
        }

        newUsers.map((u) =>
            results.push(mapUserToUserConnectionNode(u) as UserConnectionNode)
        )
    } catch (error) {
        results.length = 0
        if (errs.length === 0) {
            let mess = 'Unknown error'

            if (typeof error === 'string') {
                mess = error
            } else {
                if (error instanceof Error) {
                    mess = error.message
                }
            }
            errs.push(
                new APIError({
                    code: customErrors.database_save_error.code,
                    message: customErrors.database_save_error.message,
                    variables: [mess],
                    entity: 'User',
                })
            )
        }
    }
    if (errs.length > 0) {
        throw errs
    }

    const resultValue: UsersMutationResult = { users: results }

    return resultValue
}
