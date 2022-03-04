import { getManager, In, WhereExpression } from 'typeorm'
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
import { v4 as uuid_v4 } from 'uuid'
import { customErrors } from '../types/errors/customError'
import {
    AddOrganizationRolesToUserInput,
    AddSchoolRolesToUserInput,
    RemoveOrganizationRolesFromUserInput,
    RemoveSchoolRolesFromUserInput,
    UpdateUserInput,
    UserContactInfo,
    UsersMutationResult,
} from '../types/graphQL/user'
import { Brackets, EntityManager, getConnection } from 'typeorm'
import { CreateUserInput } from '../types/graphQL/user'
import { UserConnectionNode } from '../types/graphQL/user'
import {
    createUserSchema,
    updateUserSchema,
} from '../utils/mutations/validations/user'
import clean from '../utils/clean'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    createUnauthorizedAPIError,
} from '../utils/resolvers/errors'
import { getMap, SchoolMembershipMap } from '../utils/resolvers/entityMaps'
import { config } from '../config/config'
import {
    AddMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    RemoveMutation,
    validateNoDuplicateAttribute,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { ObjMap } from '../utils/stringUtils'
import {
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
    flagNonExistentSchoolMembership,
} from '../utils/resolvers/inputValidation'
import { Organization } from '../entities/organization'

type IdentifyingField = 'username' | 'email' | 'phone'
export interface AddSchoolRolesToUsersEntityMap
    extends RemoveSchoolRolesFromUsersEntityMap {
    schoolOrg: Map<string, Organization>
    orgRoles: Map<string, Role[]>
}

function getUserIdentifier(
    username?: string | null,
    email?: string | null,
    phone?: string | null
): string {
    return username ? username : email ? email : phone || ''
}

function getUserIdentifyingFieldName(
    username?: string | null,
    email?: string | null
): IdentifyingField {
    return username ? 'username' : email ? 'email' : 'phone'
}

export class AddSchoolRolesToUsers extends AddMutation<
    User,
    AddSchoolRolesToUserInput,
    UsersMutationResult,
    AddSchoolRolesToUsersEntityMap,
    SchoolMembership
> {
    protected EntityType = User
    protected inputTypeName = 'AddSchoolRolesToUsersInput'
    protected mainEntityIds: string[]
    protected output: UsersMutationResult = { users: [] }

    constructor(
        input: AddSchoolRolesToUserInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((i) => i.userId)
    }

    async generateEntityMaps(
        input: AddSchoolRolesToUserInput[]
    ): Promise<AddSchoolRolesToUsersEntityMap> {
        const schoolIds = input.map((i) => i.schoolId)
        const userIds = input.map((i) => i.userId)
        const schoolMap = getMap.school(schoolIds, ['organization'])

        const schoolOrg = new Map<string, Organization>()

        const orgRoles = new Map<string, Role[]>()

        for (const [schoolId, school] of (await schoolMap).entries()) {
            const org = (await school.organization)!
            schoolOrg.set(schoolId, org)
            orgRoles.set(org.organization_id, [])
        }

        const allRolesFromSchoolOrgs = await Role.find({
            // don't query system roles, as these are valid for all organizations anyway
            where: [
                {
                    system_role: false,
                    organization: {
                        organization_id: In(
                            Array.from(schoolOrg.values()).map(
                                (o) => o.organization_id
                            )
                        ),
                    },
                },
            ],
        })

        for (const role of allRolesFromSchoolOrgs) {
            const roleOrgId = (await role.organization)!.organization_id
            const roles = orgRoles.get(roleOrgId) ?? []
            roles.push(role)
            orgRoles.set(roleOrgId, roles)
        }

        const userMap = getMap.user(userIds)
        const roleMap = getMap.role(
            input.flatMap((i) => i.roleIds),
            ['organization']
        )
        const membershipMap = getMap.membership.school(schoolIds, userIds, [
            'roles',
        ])

        // Make map for memberships' roles (does not need to query db)
        const membershipRoles = new ObjMap<
            { schoolId: string; userId: string },
            Role[]
        >()
        for (const [key, membership] of (await membershipMap).entries()) {
            if (membership.roles) {
                // eslint-disable-next-line no-await-in-loop
                membershipRoles.set(key, await membership.roles)
            }
        }

        return {
            mainEntity: await userMap,
            schools: await schoolMap,
            roles: await roleMap,
            memberships: await membershipMap,
            membershipRoles,
            schoolOrg,
            orgRoles,
        }
    }

    async authorize(
        input: AddSchoolRolesToUserInput[],
        entityMaps: AddSchoolRolesToUsersEntityMap
    ): Promise<void> {
        const school_ids = input.map((i) => i.schoolId)
        const schoolMap = entityMaps.schools
        const orgIdPromises = input
            .map((i) =>
                schoolMap
                    .get(i.schoolId)
                    ?.organization?.then((o) => o.organization_id)
            )
            .filter((op): op is Promise<string> => op !== undefined)

        await this.permissions.rejectIfNotAllowed(
            { organization_ids: await Promise.all(orgIdPromises), school_ids },
            PermissionName.edit_users_40330
        )
    }

    validationOverAllInputs(
        inputs: AddSchoolRolesToUserInput[]
    ): {
        validInputs: { index: number; input: AddSchoolRolesToUserInput }[]
        apiErrors: APIError[]
    } {
        const duplicateUserIdErrorMap = validateNoDuplicateAttribute(
            inputs.map((i) => {
                return { entityId: i.schoolId, attributeValue: i.userId }
            }),
            'School',
            'user_id'
        )

        const roleIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'roleIds'
        )

        return filterInvalidInputs(inputs, [
            duplicateUserIdErrorMap,
            ...roleIdsErrorMap,
        ])
    }

    validate(
        index: number,
        _currentEntity: User | undefined,
        currentInput: AddSchoolRolesToUserInput,
        entityMaps: AddSchoolRolesToUsersEntityMap
    ): APIError[] {
        const { userId, schoolId, roleIds } = currentInput
        const errors: APIError[] = []

        const schoolMap = entityMaps.schools
        const schools = flagNonExistent(School, index, [schoolId], schoolMap)
        const userMap = entityMaps.mainEntity
        const users = flagNonExistent(User, index, [userId], userMap)
        const roleMap = entityMaps.roles
        const roles = flagNonExistent(Role, index, roleIds, roleMap)
        errors.push(...schools.errors, ...users.errors, ...roles.errors)

        if (users.errors.length || schools.errors.length) return errors

        const membership = flagNonExistentSchoolMembership(
            index,
            schoolId,
            [userId],
            entityMaps.memberships
        )

        errors.push(...membership.errors)

        if (membership.errors.length) return errors

        const existingRoles = entityMaps.membershipRoles.get({
            schoolId,
            userId,
        })!

        const roleInSchoolErrors = flagExistentChild(
            School,
            Role,
            index,
            schoolId,
            roleIds,
            new Set(existingRoles.map((r) => r.role_id))
        )

        errors.push(...roleInSchoolErrors)

        const schoolOrg = entityMaps.schoolOrg.get(schoolId)!
        const orgRoles = entityMaps.orgRoles.get(schoolOrg.organization_id)!

        const roleInOrgErrors = flagNonExistentChild(
            Organization,
            Role,
            index,
            schoolOrg.organization_id,
            // system roles are always allowed
            roles.values.filter((r) => !r.system_role).map((r) => r.role_id),
            new Set(orgRoles.map((r) => r.role_id))
        )

        errors.push(...roleInOrgErrors)

        return errors
    }

    process(
        currentInput: AddSchoolRolesToUserInput,
        maps: AddSchoolRolesToUsersEntityMap,
        index: number
    ): { outputEntity: User; modifiedEntity: SchoolMembership[] } {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const { userId, schoolId, roleIds } = currentInput
        const dbMembership = maps.memberships.get({ schoolId, userId })!
        const dbMembershipRoles = maps.membershipRoles.get({
            schoolId,
            userId,
        })!
        dbMembership.roles = Promise.resolve([
            ...dbMembershipRoles,
            ...roleIds.map((rId) => maps.roles.get(rId)!),
        ])
        return { outputEntity: currentEntity, modifiedEntity: [dbMembership] }
    }

    async applyToDatabase(
        results: Pick<
            ProcessedResult<User, SchoolMembership>,
            'modifiedEntity'
        >[]
    ): Promise<void> {
        const saveEntities = results.flatMap((r) => r.modifiedEntity)
        await getManager().save(saveEntities)
    }

    protected buildOutput = async (currentEntity: User): Promise<void> => {
        this.output.users.push(mapUserToUserConnectionNode(currentEntity))
    }
}

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
    const orgIds = args.input.map((val) => val.organizationId)
    const userIds = args.input.map((val) => val.userId)
    const orgMapPromise = getMap.organization(orgIds)
    const userMapPromise = getMap.user(userIds)
    const roleMapPromise = getMap.role(args.input.flatMap((val) => val.roleIds))
    const membershipMapPromise = getMap.membership.organization(
        orgIds,
        userIds,
        ['roles']
    )
    const preloadedOrganizations = await orgMapPromise
    const preloadedUsers = await userMapPromise
    const preloadedRoles = await roleMapPromise
    const preloadedMemberships = await membershipMapPromise

    // Process inputs
    const errors: APIError[] = []
    const memberships: OrganizationMembership[] = []
    const output: CoreUserConnectionNode[] = []
    for (const [index, subArgs] of args.input.entries()) {
        const { organizationId, userId, roleIds } = subArgs

        const orgs = flagNonExistent(
            Organization,
            index,
            [organizationId],
            preloadedOrganizations
        )
        const roles = flagNonExistent(Role, index, roleIds, preloadedRoles)
        const users = flagNonExistent(User, index, [userId], preloadedUsers)
        errors.push(...orgs.errors, ...roles.errors, ...users.errors)

        if (orgs.errors.length || users.errors.length) continue
        const dbMemberships = flagNonExistentOrganizationMembership(
            index,
            organizationId,
            [userId],
            preloadedMemberships
        )
        if (dbMemberships.errors) errors.push(...dbMemberships.errors)

        for (const dbMembership of dbMemberships.values) {
            if (errors.length > 0) continue
            // eslint-disable-next-line no-await-in-loop
            const dbMembershipRoles = (await dbMembership.roles) || [] // already fetched
            dbMembership.roles = Promise.resolve(
                roleModificationFn(dbMembershipRoles, roles.values)
            )
            memberships.push(dbMembership)
        }

        // Build output
        if (errors.length > 0) continue
        output.push(mapUserToUserConnectionNode(users.values[0]))
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

export interface RemoveSchoolRolesFromUsersEntityMap extends EntityMap<User> {
    mainEntity: Map<string, User>
    schools: Map<string, School>
    roles: Map<string, Role>
    memberships: SchoolMembershipMap
    membershipRoles: ObjMap<{ schoolId: string; userId: string }, Role[]>
}

export class RemoveSchoolRolesFromUsers extends RemoveMutation<
    User,
    RemoveSchoolRolesFromUserInput,
    UsersMutationResult,
    RemoveSchoolRolesFromUsersEntityMap,
    SchoolMembership
> {
    protected EntityType = User
    protected inputTypeName = 'RemoveSchoolRolesFromUserInput'
    protected mainEntityIds: string[]
    protected output: UsersMutationResult = { users: [] }

    constructor(
        input: RemoveSchoolRolesFromUserInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((i) => i.userId)
    }

    async generateEntityMaps(input: RemoveSchoolRolesFromUserInput[]) {
        // Kick off db requests
        const schoolIds = input.map((i) => i.schoolId)
        const userIds = input.map((i) => i.userId)
        const schoolMap = getMap.school(schoolIds, ['organization'])
        const userMap = getMap.user(userIds)
        const roleMap = getMap.role(input.flatMap((i) => i.roleIds))
        const membershipMap = getMap.membership.school(schoolIds, userIds, [
            'roles',
        ])
        // Make map for memberships' roles (does not need to query db)
        const membershipRoles = new ObjMap<
            { schoolId: string; userId: string },
            Role[]
        >()
        for (const [key, membership] of (await membershipMap).entries()) {
            if (membership.roles !== undefined) {
                // eslint-disable-next-line no-await-in-loop
                membershipRoles.set(key, await membership.roles)
            }
        }
        return {
            mainEntity: await userMap,
            schools: await schoolMap,
            roles: await roleMap,
            memberships: await membershipMap,
            membershipRoles,
        }
    }

    async authorize(
        input: RemoveSchoolRolesFromUserInput[],
        entityMaps: RemoveSchoolRolesFromUsersEntityMap
    ): Promise<void> {
        const school_ids = input.map((i) => i.schoolId)
        const schoolMap = entityMaps.schools
        const orgIdPromises = input
            .map((i) =>
                schoolMap
                    .get(i.schoolId)
                    ?.organization?.then((o) => o.organization_id)
            )
            .filter((op): op is Promise<string> => op !== undefined)

        await this.permissions.rejectIfNotAllowed(
            { organization_ids: await Promise.all(orgIdPromises), school_ids },
            PermissionName.edit_users_40330
        )
    }

    validationOverAllInputs(
        inputs: RemoveSchoolRolesFromUserInput[]
    ): {
        validInputs: { index: number; input: RemoveSchoolRolesFromUserInput }[]
        apiErrors: APIError[]
    } {
        const failedDuplicateInputs = validateNoDuplicateAttribute(
            inputs.map((i) => {
                return { entityId: i.schoolId, attributeValue: i.userId }
            }),
            'School',
            'user_id'
        )

        const roleIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'roleIds'
        )

        return filterInvalidInputs(inputs, [
            failedDuplicateInputs,
            ...roleIdsErrorMap,
        ])
    }

    validate(
        index: number,
        _currentEntity: User | undefined,
        currentInput: RemoveSchoolRolesFromUserInput,
        entityMaps: RemoveSchoolRolesFromUsersEntityMap
    ): APIError[] {
        const { userId, schoolId, roleIds } = currentInput
        const errors: APIError[] = []

        const schoolMap = entityMaps.schools
        const schools = flagNonExistent(School, index, [schoolId], schoolMap)
        const userMap = entityMaps.mainEntity
        const users = flagNonExistent(User, index, [userId], userMap)
        const roleMap = entityMaps.roles
        const roles = flagNonExistent(Role, index, roleIds, roleMap)
        errors.push(...schools.errors, ...users.errors, ...roles.errors)

        if (schools.errors.length || users.errors.length) return errors
        const membership = flagNonExistentSchoolMembership(
            index,
            schoolId,
            [userId],
            entityMaps.memberships
        )

        errors.push(...membership.errors)

        if (membership.errors.length) return errors

        const existingRoles = entityMaps.membershipRoles.get({
            schoolId,
            userId,
        })!

        const roleInSchoolErrors = flagNonExistentChild(
            School,
            Role,
            index,
            schoolId,
            roleIds,
            new Set(existingRoles.map((role) => role.role_id))
        )

        errors.push(...roleInSchoolErrors)

        return errors
    }

    protected process(
        currentInput: RemoveSchoolRolesFromUserInput,
        maps: RemoveSchoolRolesFromUsersEntityMap,
        index: number
    ): ProcessedResult<User, SchoolMembership> {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const { userId, schoolId, roleIds } = currentInput
        const roleIdsSet = new Set(roleIds)
        const dbMembership = maps.memberships.get({ schoolId, userId })!
        const dbMembershipRoles = maps.membershipRoles.get({
            schoolId,
            userId,
        })!
        dbMembership.roles = Promise.resolve(
            dbMembershipRoles.filter((dmr) => !roleIdsSet.has(dmr.role_id))
        )
        return { outputEntity: currentEntity, modifiedEntity: [dbMembership] }
    }

    protected async applyToDatabase(
        results: ProcessedResult<User, SchoolMembership>[]
    ): Promise<void> {
        const saveEntities = results
            .flatMap((r) => r.modifiedEntity)
            .filter((r): r is SchoolMembership => r !== undefined)
        await getManager().save(saveEntities)
    }

    protected buildOutput = async (currentEntity: User): Promise<void> => {
        this.output.users.push(mapUserToUserConnectionNode(currentEntity))
    }
}

// Uses the same "clean.xxxx()" calls as the csv functions do
function cleanCreateUserInput(cui: CreateUserInput): CreateUserInput {
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

// We check the entire input array in the database in ONE query to find if any of the input records that we are intending to submit
// already exist in the database.
// Note: The query, though in separate "OrWhere" clauses, is ONE query and the variable name contexts share
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
            cui.contactInfo?.email,
            cui.contactInfo?.phone,
            cui.username
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
                getUserIdentifier(
                    v.username,
                    v.contactInfo?.email,
                    v.contactInfo?.phone
                )
            ),
            i,
        ])
    )

    const results: number[] = []
    for (const user of users) {
        const userKey = makeLookupKey(
            user.given_name,
            user.family_name,
            getUserIdentifier(user.username, user.email, user.phone)
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
        const identifyingFieldName = getUserIdentifyingFieldName(
            input.username,
            input.contactInfo?.email
        )

        const fieldValueRelation = {
            username: input.username,
            email: input.contactInfo?.email,
            phone: input.contactInfo?.phone,
        }

        errs.push(
            createEntityAPIError(
                'existent',
                index,
                'User',
                `${input.givenName} ${input.familyName} with ${identifyingFieldName} ${fieldValueRelation[identifyingFieldName]}`,
                undefined,
                undefined,
                ['givenName', 'familyName', `${identifyingFieldName}`]
            )
        )
    }
    return errs
}

// We build a key for a map, I am using maps to reduce the looping through arrays to
// a minimum when looking up values
export function makeLookupKey(
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

export function keyToPrintableString(key: string): string {
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
            getUserIdentifier(
                createUserInput.username,
                createUserInput.contactInfo?.email,
                createUserInput.contactInfo?.phone
            )
        )
        if (inputMap.has(key)) {
            errs.push(
                createDuplicateAttributeAPIError(
                    i,
                    [
                        'givenName',
                        'familyName',
                        `${getUserIdentifyingFieldName(
                            createUserInput.username,
                            createUserInput.contactInfo?.email
                        )}`,
                    ],
                    'User'
                )
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
        newUser.email = cui.contactInfo?.email
            ? cui.contactInfo.email
            : undefined
        newUser.phone = cui.contactInfo?.phone
            ? cui.contactInfo.phone
            : undefined
        newUser.gender = cui.gender
        newUser.username = cui.username ? cui.username : undefined
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

        throw new APIErrorCollection(errs)
    }

    if (inputs.length === 0) errs.push(createInputLengthAPIError('User', 'min'))

    if (inputs.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        errs.push(createInputLengthAPIError('User', 'max'))

    if (errs.length > 0) throw new APIErrorCollection(errs)

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

    if (errs.length > 0) throw new APIErrorCollection(errs)

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
            updatedUser.date_of_birth = uui.dateOfBirth ?? undefined
            updatedUser.alternate_email = uui.alternateEmail ?? undefined
            updatedUser.alternate_phone = uui.alternatePhone ?? undefined
            updatedUser.avatar = uui.avatar ?? undefined
            updatedUser.date_of_birth = uui.dateOfBirth ?? undefined
            updatedUser.primary = uui.primaryUser ?? updatedUser.primary
            updatedUsers.push(updatedUser)
        }
    }
    return updatedUsers
}

function cleanUpdateUserInput(uui: UpdateUserInput): UpdateUserInput {
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
    phone?: string | null,
    username?: string | null
): WhereExpression {
    const searchParameters: Record<string, string | undefined | null> = {}
    searchParameters[`given_name${i}`] = given
    searchParameters[`family_name${i}`] = family
    let whereStr: string
    if (username) {
        searchParameters[`username${i}`] = username
        whereStr = `User.username = :username${i} AND User.given_name = :given_name${i} AND User.family_name = :family_name${i}`
    } else if (email) {
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
                const username = uui.username ?? existingUser?.username
                checkingInputs.push({
                    id: id,
                    givenName: given,
                    familyName: family,
                    email: email,
                    phone: phone,
                    username: username,
                })
                ids.push(id)

                buildUserPersonalInfoScope(
                    oqb,
                    i,
                    given,
                    family,
                    email,
                    phone,
                    username
                )
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
                    entityName: updateUserInput.id,
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
            getUserIdentifier(
                updateUserInput.username,
                updateUserInput.email,
                updateUserInput.phone
            )
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
                            `${getUserIdentifyingFieldName(
                                updateUserInput.username,
                                updateUserInput.email
                            )}`,
                        ],
                        entity: 'User',
                        attribute: 'ID',
                        entityName: updateUserInput.id,
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
                getUserIdentifier(v.username, v.email, v.phone)
            ),
            i,
        ])
    )
    for (const u of conflictcheck.conflicts) {
        const ukey = makeLookupKey(
            u.given_name,
            u.family_name,
            getUserIdentifier(u.username, u.email, u.phone)
        )
        if (conflictsMap.has(ukey)) {
            const index = conflictsMap.get(ukey)
            if (index != undefined) {
                const contactInfo = getUserIdentifyingFieldName(
                    conflictcheck.checklist[index].username,
                    conflictcheck.checklist[index].email
                )

                const e = new APIError({
                    code: customErrors.existent_entity.code,
                    message: customErrors.existent_entity.message,
                    variables: ['givenName', 'familyName', `${contactInfo}`],
                    entity: 'User',
                    attribute: '',
                    entityName: u.user_id,
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
            entityName: inputs[index].id,
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

        throw new APIErrorCollection(errs)
    }
    if (inputs.length === 0) errs.push(createInputLengthAPIError('User', 'min'))

    if (inputs.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        errs.push(createInputLengthAPIError('User', 'max'))

    if (errs.length > 0) throw new APIErrorCollection(errs)

    const checkErrs = checkUpdateUserInputs(inputs)
    if (checkErrs.length > 0) {
        errs.push(...checkErrs)

        // Removing failing inputs,
        // because these could produce unexpected errors in next validations
        checkErrs.forEach((userError) => {
            if (userError.index) {
                inputs.splice(userError.index, 1)
            }
        })
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

        // Removing inputs related to non existent users,
        // because these could produce unexpected errors in next validations
        missingUserErrors.forEach((userError) => {
            if (userError.index) {
                normalizedInputs.splice(userError.index, 1)
            }
        })
    }

    const conflictErrs = await checkForGivenNameFamilyNameContactInfoCollisions(
        existingUserMap,
        normalizedInputs,
        manager
    )
    if (conflictErrs.length > 0) {
        errs.push(...conflictErrs)
    }

    if (errs.length > 0) throw new APIErrorCollection(errs)

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
