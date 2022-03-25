import { getManager, In } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { User } from '../entities/user'
import { Context } from '../main'
import { mapUserToUserConnectionNode } from '../pagination/usersConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    AddOrganizationRolesToUserInput,
    AddSchoolRolesToUserInput,
    RemoveOrganizationRolesFromUserInput,
    RemoveSchoolRolesFromUserInput,
    UpdateUserInput,
    UsersMutationResult,
} from '../types/graphQL/user'
import { CreateUserInput } from '../types/graphQL/user'
import {
    createUserSchema,
    updateUserSchema,
} from '../utils/mutations/validations/user'
import { createEntityAPIError } from '../utils/resolvers/errors'
import {
    getMap,
    OrganizationMembershipMap,
    SchoolMembershipMap,
} from '../utils/resolvers/entityMaps'
import {
    AddMutation,
    CreateMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    RemoveMutation,
    UpdateMutation,
    validateAtLeastOne,
    validateDataAgainstSchema,
    validateNoDuplicate,
    validateNoDuplicateAttribute,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { objectToKey, ObjMap } from '../utils/stringUtils'
import {
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
    flagNonExistentSchoolMembership,
} from '../utils/resolvers/inputValidation'
import { Organization } from '../entities/organization'
import {
    addIdentifierToKey,
    buildConflictingUserKey,
    cleanCreateUserInput,
    cleanUpdateUserInput,
    ConflictingUserKey,
    createUserInputToConflictingUserKey,
    OrganizationMembershipKey,
    updateUserInputToConflictingUserKey,
} from '../utils/resolvers/user'

interface CreateUsersEntityMap extends EntityMap<User> {
    conflictingUsers: ObjMap<ConflictingUserKey, User>
}

interface UpdateUsersEntityMap extends CreateUsersEntityMap {
    mainEntity: Map<string, User>
}

interface AddOrganizationRolesToUsersEntityMap
    extends RemoveOrganizationRolesFromUsersEntityMap {
    orgRoles: Map<string, Role[]>
}

interface RemoveOrganizationRolesFromUsersEntityMap extends EntityMap<User> {
    mainEntity: Map<string, User>
    organizations: Map<string, Organization>
    roles: Map<string, Role>
    memberships: OrganizationMembershipMap
    membershipRoles: ObjMap<{ organizationId: string; userId: string }, Role[]>
}

export interface AddSchoolRolesToUsersEntityMap
    extends RemoveSchoolRolesFromUsersEntityMap {
    schoolOrg: Map<string, Organization>
    orgRoles: Map<string, Role[]>
}

interface RemoveSchoolRolesFromUsersEntityMap extends EntityMap<User> {
    mainEntity: Map<string, User>
    schools: Map<string, School>
    roles: Map<string, Role>
    memberships: SchoolMembershipMap
    membershipRoles: ObjMap<{ schoolId: string; userId: string }, Role[]>
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

export class AddOrganizationRolesToUsers extends AddMutation<
    User,
    AddOrganizationRolesToUserInput,
    UsersMutationResult,
    AddOrganizationRolesToUsersEntityMap,
    OrganizationMembership
> {
    protected EntityType = User
    protected inputTypeName = 'AddOrganizationRolesToUsersInput'
    protected mainEntityIds: string[]
    protected output: UsersMutationResult = { users: [] }

    constructor(
        input: AddOrganizationRolesToUserInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((i) => i.userId)
    }

    async generateEntityMaps(
        input: AddOrganizationRolesToUserInput[]
    ): Promise<AddOrganizationRolesToUsersEntityMap> {
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

    async authorize(input: AddOrganizationRolesToUserInput[]): Promise<void> {
        const organizationIds = input.map((i) => i.organizationId)
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_users_40330
        )
    }

    validationOverAllInputs(
        inputs: AddOrganizationRolesToUserInput[]
    ): {
        validInputs: { index: number; input: AddOrganizationRolesToUserInput }[]
        apiErrors: APIError[]
    } {
        const failedDuplicateUsers = validateNoDuplicateAttribute(
            inputs.map((i) => {
                return { entityId: i.organizationId, attributeValue: i.userId }
            }),
            'Organization',
            'userId'
        )

        const failedRoles = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'roleIds'
        )

        return filterInvalidInputs(inputs, [
            failedDuplicateUsers,
            ...failedRoles,
        ])
    }

    validate(
        index: number,
        _currentUser: User | undefined,
        currentInput: AddOrganizationRolesToUserInput,
        maps: AddOrganizationRolesToUsersEntityMap
    ): APIError[] {
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

        const orgRoles = maps.orgRoles.get(organizationId)!
        const roleInOrgErrors = flagNonExistentChild(
            Organization,
            Role,
            index,
            organizationId,
            roles.values.filter((r) => !r.system_role).map((r) => r.role_id),
            new Set(orgRoles.map((r) => r.role_id))
        )

        errors.push(...roleInOrgErrors)

        const existingRoles = maps.membershipRoles.get({
            organizationId,
            userId,
        })!

        const alreadyAddedRolesErrors = flagExistentChild(
            Organization,
            Role,
            index,
            organizationId,
            roleIds,
            new Set(existingRoles.map((r) => r.role_id))
        )

        errors.push(...alreadyAddedRolesErrors)

        return errors
    }

    process(
        currentInput: AddOrganizationRolesToUserInput,
        maps: AddOrganizationRolesToUsersEntityMap,
        index: number
    ): { outputEntity: User; modifiedEntity: OrganizationMembership[] } {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const { userId, organizationId, roleIds } = currentInput
        const dbMembership = maps.memberships.get({ organizationId, userId })!
        const dbMembershipRoles = maps.membershipRoles.get({
            organizationId,
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
            ProcessedResult<User, OrganizationMembership>,
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

export class RemoveOrganizationRolesFromUsers extends RemoveMutation<
    User,
    RemoveOrganizationRolesFromUserInput,
    UsersMutationResult,
    RemoveOrganizationRolesFromUsersEntityMap,
    OrganizationMembership
> {
    protected EntityType = User
    protected inputTypeName = 'RemoveOrganizationRolesFromUserInput'
    protected mainEntityIds: string[]
    protected output: UsersMutationResult = { users: [] }

    constructor(
        input: RemoveOrganizationRolesFromUserInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((i) => i.userId)
    }

    async generateEntityMaps(
        input: RemoveOrganizationRolesFromUserInput[]
    ): Promise<RemoveOrganizationRolesFromUsersEntityMap> {
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
        }
    }

    async authorize(
        input: RemoveOrganizationRolesFromUserInput[]
    ): Promise<void> {
        const organizationIds = input.map((i) => i.organizationId)
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_users_40330
        )
    }

    validationOverAllInputs(
        inputs: RemoveOrganizationRolesFromUserInput[]
    ): {
        validInputs: {
            index: number
            input: RemoveOrganizationRolesFromUserInput
        }[]
        apiErrors: APIError[]
    } {
        const failedDuplicateUsers = validateNoDuplicateAttribute(
            inputs.map((i) => {
                return { entityId: i.organizationId, attributeValue: i.userId }
            }),
            'Organization',
            'userId'
        )

        const failedRoles = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'roleIds'
        )

        return filterInvalidInputs(inputs, [
            failedDuplicateUsers,
            ...failedRoles,
        ])
    }

    validate(
        index: number,
        _currentUser: User | undefined,
        currentInput: RemoveOrganizationRolesFromUserInput,
        maps: RemoveOrganizationRolesFromUsersEntityMap
    ): APIError[] {
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

        const existingRoles = maps.membershipRoles.get({
            organizationId,
            userId,
        })!

        const roleInMembershipErrors = flagNonExistentChild(
            Organization,
            Role,
            index,
            organizationId,
            roleIds,
            new Set(existingRoles.map((r) => r.role_id))
        )

        errors.push(...roleInMembershipErrors)

        return errors
    }

    protected process(
        currentInput: RemoveOrganizationRolesFromUserInput,
        maps: RemoveOrganizationRolesFromUsersEntityMap,
        index: number
    ): ProcessedResult<User, OrganizationMembership> {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const { userId, organizationId, roleIds } = currentInput
        const roleIdsSet = new Set(roleIds)
        const dbMembership = maps.memberships.get({ organizationId, userId })!
        const dbMembershipRoles = maps.membershipRoles.get({
            organizationId,
            userId,
        })!

        dbMembership.roles = Promise.resolve(
            dbMembershipRoles.filter((dmr) => !roleIdsSet.has(dmr.role_id))
        )

        return { outputEntity: currentEntity, modifiedEntity: [dbMembership] }
    }

    protected async applyToDatabase(
        results: ProcessedResult<User, OrganizationMembership>[]
    ): Promise<void> {
        const saveEntities = results
            .flatMap((r) => r.modifiedEntity)
            .filter((r): r is OrganizationMembership => r !== undefined)

        await getManager().save(saveEntities)
    }

    protected buildOutput = async (currentEntity: User): Promise<void> => {
        this.output.users.push(mapUserToUserConnectionNode(currentEntity))
    }
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

export class CreateUsers extends CreateMutation<
    User,
    CreateUserInput,
    UsersMutationResult,
    CreateUsersEntityMap
> {
    protected readonly EntityType = User
    protected inputTypeName = 'CreateUserInput'
    protected output: UsersMutationResult = { users: [] }

    async generateEntityMaps(
        input: CreateUserInput[]
    ): Promise<CreateUsersEntityMap> {
        const userKeys: ConflictingUserKey[] = []

        input.forEach((i) => {
            const inputKey = createUserInputToConflictingUserKey(i)
            const key = buildConflictingUserKey(inputKey)

            userKeys.push(key)
        })

        const matchingPreloadedUserArray = User.find({
            where: userKeys.map((k) => {
                const { givenName, familyName, username, email, phone } = k
                const condition = {
                    given_name: givenName,
                    family_name: familyName,
                    ...addIdentifierToKey(username, email, phone),
                }

                return condition
            }),
        })

        const conflictingUsers = new ObjMap<ConflictingUserKey, User>()
        for (const u of await matchingPreloadedUserArray) {
            const { given_name, family_name, username, email, phone } = u
            conflictingUsers.set(
                {
                    givenName: given_name!,
                    familyName: family_name!,
                    ...addIdentifierToKey(username, email, phone),
                },
                u
            )
        }

        return {
            conflictingUsers,
        }
    }

    async authorize(): Promise<void> {
        const isAdmin = this.permissions.isAdmin
        if (!isAdmin) {
            const createUsersPermission = PermissionName.create_users_40220
            const orgs = await this.permissions.orgMembershipsWithPermissions([
                createUsersPermission,
            ])

            if (!orgs.length) {
                throw new Error(
                    `User(${this.permissions.getUserId()}) does not have Permission(${createUsersPermission})`
                )
            }
        }
    }

    validationOverAllInputs(
        inputs: CreateUserInput[]
    ): {
        validInputs: { index: number; input: CreateUserInput }[]
        apiErrors: APIError[]
    } {
        const failedDataFormat = validateDataAgainstSchema(
            inputs,
            createUserSchema,
            this.EntityType.name
        )

        const inputValues = inputs.map((i) =>
            objectToKey(
                buildConflictingUserKey(createUserInputToConflictingUserKey(i))
            )
        )

        const failedDuplicates = validateNoDuplicate(
            inputValues,
            this.inputTypeName,
            ['givenName', 'familyName', 'username', 'phone', 'email']
        )

        return filterInvalidInputs(inputs, [failedDataFormat, failedDuplicates])
    }

    protected normalize(inputs: CreateUserInput[]): CreateUserInput[] {
        return Array.from(inputs, (i) => cleanCreateUserInput(i))
    }

    validate(
        index: number,
        _user: undefined,
        currentInput: CreateUserInput,
        maps: CreateUsersEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const key = buildConflictingUserKey(
            createUserInputToConflictingUserKey(currentInput)
        )

        const conflictingUserId = maps.conflictingUsers.get(key)?.user_id
        if (conflictingUserId) {
            errors.push(
                createEntityAPIError(
                    'existent',
                    index,
                    'User',
                    conflictingUserId,
                    undefined,
                    undefined,
                    ['user_id']
                )
            )
        }

        return errors
    }

    protected process(currentInput: CreateUserInput) {
        const {
            givenName,
            familyName,
            gender,
            dateOfBirth,
            username,
            contactInfo,
            alternateEmail,
            alternatePhone,
        } = currentInput

        const user = new User()
        user.given_name = givenName
        user.family_name = familyName
        user.gender = gender
        user.date_of_birth = dateOfBirth
        user.username = username || undefined
        user.email = contactInfo?.email || undefined
        user.phone = contactInfo?.phone || undefined
        user.alternate_email = alternateEmail
        user.alternate_phone = alternatePhone

        return { outputEntity: user }
    }

    protected async buildOutput(outputUser: User): Promise<void> {
        const userConnectionNode = mapUserToUserConnectionNode(outputUser)
        this.output.users.push(userConnectionNode)
    }
}

export class UpdateUsers extends UpdateMutation<
    User,
    UpdateUserInput,
    UsersMutationResult,
    UpdateUsersEntityMap
> {
    protected readonly EntityType = User
    protected inputTypeName = 'UpdateUserInput'
    protected mainEntityIds: string[]
    protected output: UsersMutationResult = { users: [] }

    constructor(input: UpdateUserInput[], permissions: Context['permissions']) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: UpdateUserInput[]
    ): Promise<UpdateUsersEntityMap> {
        const ids: string[] = input.map((i) => i.id)
        const mainEntity = await getMap.user(ids)

        const userKeys: ConflictingUserKey[] = input.map((i) =>
            updateUserInputToConflictingUserKey(i, mainEntity)
        )

        const matchingPreloadedUserArray = await User.find({
            where: userKeys.map((k) => {
                const { givenName, familyName, username, email, phone } = k
                const condition = {
                    given_name: givenName,
                    family_name: familyName,
                    ...addIdentifierToKey(username, email, phone),
                }

                return condition
            }),
        })

        const conflictingUsers = new ObjMap<ConflictingUserKey, User>()
        for (const u of matchingPreloadedUserArray) {
            const { given_name, family_name, username, email, phone } = u

            conflictingUsers.set(
                {
                    givenName: given_name!,
                    familyName: family_name!,
                    ...addIdentifierToKey(username, email, phone),
                },
                u
            )
        }

        return {
            mainEntity,
            conflictingUsers,
        }
    }

    async authorize(): Promise<void> {
        const isAdmin = this.permissions.isAdmin
        if (!isAdmin) {
            const updateUsersPermission = PermissionName.edit_users_40330
            const orgs = await this.permissions.orgMembershipsWithPermissions([
                updateUsersPermission,
            ])

            if (!orgs.length) {
                throw new Error(
                    `User(${this.permissions.getUserId()}) does not have Permission(${updateUsersPermission})`
                )
            }
        }
    }

    validationOverAllInputs(
        inputs: UpdateUserInput[],
        maps: UpdateUsersEntityMap
    ): {
        validInputs: { index: number; input: UpdateUserInput }[]
        apiErrors: APIError[]
    } {
        const failedAtLeastOne = validateAtLeastOne(
            inputs,
            this.inputTypeName,
            [
                'givenName',
                'familyName',
                'email',
                'phone',
                'username',
                'dateOfBirth',
                'gender',
                'avatar',
                'alternateEmail',
                'alternatePhone',
                'primaryUser',
            ]
        )

        const failedDuplicates = validateNoDuplicate(
            inputs.map((i) => i.id),
            this.inputTypeName,
            ['id']
        )

        const failedDataFormat = validateDataAgainstSchema(
            inputs,
            updateUserSchema,
            this.EntityType.name
        )

        const inputValues = inputs.map((i) =>
            objectToKey(
                buildConflictingUserKey(
                    updateUserInputToConflictingUserKey(i, maps.mainEntity)
                )
            )
        )

        const failedPersonalDataDuplicates = validateNoDuplicate(
            inputValues,
            this.inputTypeName,
            ['givenName', 'familyName', 'username', 'phone', 'email']
        )

        return filterInvalidInputs(inputs, [
            failedAtLeastOne,
            failedDuplicates,
            failedDataFormat,
            failedPersonalDataDuplicates,
        ])
    }

    protected normalize(inputs: UpdateUserInput[]): UpdateUserInput[] {
        return Array.from(inputs, (i) => cleanUpdateUserInput(i))
    }

    validate(
        index: number,
        currentUser: User | undefined,
        currentInput: UpdateUserInput,
        maps: UpdateUsersEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { id } = currentInput

        const userExists = flagNonExistent(User, index, [id], maps.mainEntity)
        errors.push(...userExists.errors)

        const key = buildConflictingUserKey(
            updateUserInputToConflictingUserKey(currentInput, maps.mainEntity)
        )

        const conflictingUserId = maps.conflictingUsers.get(key)?.user_id
        const currentUserId = currentUser?.user_id
        if (
            conflictingUserId &&
            currentUserId &&
            conflictingUserId !== currentUserId
        ) {
            errors.push(
                createEntityAPIError(
                    'existent',
                    index,
                    'User',
                    conflictingUserId,
                    undefined,
                    undefined,
                    ['givenName', 'familyName', 'username', 'email']
                )
            )
        }

        return errors
    }

    protected process(
        currentInput: UpdateUserInput,
        maps: UpdateUsersEntityMap
    ): ProcessedResult<User, User> {
        const {
            id,
            givenName,
            familyName,
            email,
            phone,
            username,
            dateOfBirth,
            gender,
            avatar,
            alternateEmail,
            alternatePhone,
            primaryUser,
        } = currentInput

        const user = maps.mainEntity.get(id)!
        user.given_name = givenName || user.given_name
        user.family_name = familyName || user.family_name
        user.email = email || user.email
        user.phone = phone || user.phone
        user.username = username || user.username
        user.date_of_birth = dateOfBirth || user.date_of_birth
        user.gender = gender || user.gender
        user.avatar = avatar || user.avatar
        user.alternate_email = alternateEmail || user.alternate_email
        user.alternate_phone = alternatePhone || user.alternate_phone
        user.primary = primaryUser || user.primary

        return { outputEntity: user }
    }

    protected async buildOutput(outputUser: User): Promise<void> {
        const userConnectionNode = mapUserToUserConnectionNode(outputUser)
        this.output.users.push(userConnectionNode)
    }
}
