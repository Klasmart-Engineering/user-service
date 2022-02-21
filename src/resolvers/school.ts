import { In, WhereExpression } from 'typeorm'
import { Organization } from '../entities/organization'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { Status } from '../entities/status'
import { User } from '../entities/user'
import { Context } from '../main'
import {
    mapSchoolToSchoolConnectionNode,
    schoolConnectionNodeFields,
} from '../pagination/schoolsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateSchoolInput,
    DeleteSchoolInput,
    RemoveUsersFromSchoolInput,
    SchoolsMutationResult,
    AddClassesToSchoolInput,
    UpdateSchoolInput,
    AddProgramsToSchoolInput,
    RemoveProgramsFromSchoolInput,
    AddUsersToSchoolInput,
    RemoveClassesFromSchoolInput,
} from '../types/graphQL/school'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    AddMutation,
    UpdateMutation,
    RemoveMembershipMutation,
    AddMembershipMutation,
    DeleteEntityMap,
    validateActiveAndNoDuplicates,
    ProcessedResult,
    validateSubItemsLengthAndNoDuplicates,
    filterInvalidInputs,
    RemoveMutation,
    validateNoDuplicates,
} from '../utils/mutations/commonStructure'
import { Class } from '../entities/class'
import {
    createEntityAPIError,
    createDuplicateAttributeAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers/errors'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import { config } from '../config/config'
import { getMap, SchoolMembershipMap } from '../utils/resolvers/entityMaps'
import { Program } from '../entities/program'
import { Role } from '../entities/role'
import {
    flagExistentChild,
    flagExistentSchoolMembership,
    flagNonExistent,
    flagNonExistentChild,
} from '../utils/resolvers/inputValidation'
import { customErrors } from '../types/errors/customError'

export interface CreateSchoolEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    matchingOrgsAndShortcodes: Map<string, School>
    organizations: Map<string, Organization>
}
export class CreateSchools extends CreateMutation<
    School,
    CreateSchoolInput,
    SchoolsMutationResult,
    CreateSchoolEntityMap
> {
    protected readonly EntityType = School
    protected inputTypeName = 'CreateSchoolInput'
    protected orgIds: string[]
    protected output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: CreateSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.orgIds = Array.from(
            new Set(input.map((val) => val.organizationId).flat())
        )
    }

    generateEntityMaps = (
        input: CreateSchoolInput[]
    ): Promise<CreateSchoolEntityMap> =>
        generateMapsForCreate(input, this.orgIds)

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.orgIds },
            PermissionName.create_school_20220
        )
    }

    validationOverAllInputs(inputs: CreateSchoolInput[]) {
        return {
            validInputs: inputs.map((i, index) => {
                return { input: i, index }
            }),
            apiErrors: [],
        }
    }

    protected validate(
        index: number,
        _entity: School,
        currentInput: CreateSchoolInput,
        maps: CreateSchoolEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, name, shortCode } = currentInput

        const organization = maps.organizations.get(organizationId)

        if (!organization) {
            errors.push(
                createNonExistentOrInactiveEntityAPIError(
                    index,
                    ['organization_id'],
                    'ID',
                    'Organization',
                    organizationId
                )
            )
        }

        const schoolExist = maps.mainEntity.get(
            [organizationId, name].toString()
        )

        if (schoolExist) {
            errors.push(
                createEntityAPIError(
                    'existentChild',
                    index,
                    'School',
                    name,
                    'Organization',
                    organizationId,
                    ['organizationId', 'name']
                )
            )
        }
        const matchingOrgAndShortcode = maps.matchingOrgsAndShortcodes.get(
            [organizationId, shortCode].toString()
        )
        if (matchingOrgAndShortcode) {
            errors.push(
                createEntityAPIError(
                    'existentChild',
                    index,
                    'School',
                    shortCode,
                    'Organization',
                    organizationId,
                    ['organizationId', 'shortCode']
                )
            )
        }
        return errors
    }

    protected process(
        currentInput: CreateSchoolInput,
        maps: CreateSchoolEntityMap
    ) {
        const { organizationId, name, shortCode } = currentInput

        const school = new School()
        school.school_name = name
        school.shortcode = shortCode
            ? formatShortCode(shortCode)
            : generateShortCode(name)
        school.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        return { outputEntity: school }
    }

    protected async buildOutput(outputEntity: School): Promise<void> {
        const schoolConnectionNode = await mapSchoolToSchoolConnectionNode(
            outputEntity
        )
        this.output.schools.push(schoolConnectionNode)
    }
}

export interface UpdateSchoolEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    matchingOrgsAndShortcodes: Map<string, School>
    matchingOrgsAndNames: Map<string, School>
}

export class UpdateSchools extends UpdateMutation<
    School,
    UpdateSchoolInput,
    SchoolsMutationResult,
    UpdateSchoolEntityMap
> {
    protected readonly EntityType = School
    protected readonly EntityPrimaryKey = School
    protected readonly inputTypeName = 'UpdateSchoolInput'
    protected readonly mainEntityIds: string[]
    protected readonly output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: UpdateSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(
        input: UpdateSchoolInput[]
    ): Promise<UpdateSchoolEntityMap> {
        const names = input.map((val) => val.name)
        const shortCodes = input.map((val) => val.shortCode)

        const preloadedSchoolArray = School.find({
            where: {
                school_id: In(this.mainEntityIds),
            },
            relations: ['organization'],
        })

        const matchingPreloadedSchoolArray = School.find({
            where: [
                {
                    school_name: In(names),
                },
                {
                    shortcode: In(shortCodes),
                },
            ],
            relations: ['organization'],
        })

        const matchingOrgsAndNames = new Map<string, School>()
        const matchingOrgsAndShortcodes = new Map<string, School>()
        for (const s of await matchingPreloadedSchoolArray) {
            // eslint-disable-next-line no-await-in-loop
            const orgId = (await s.organization)?.organization_id || ''
            matchingOrgsAndNames.set([orgId, s.school_name].toString(), s)
            matchingOrgsAndShortcodes.set([orgId, s.shortcode].toString(), s)
        }

        return {
            mainEntity: new Map(
                (await preloadedSchoolArray).map((s) => [s.school_id, s])
            ),
            matchingOrgsAndNames,
            matchingOrgsAndShortcodes,
        }
    }

    protected async authorize(
        _input: UpdateSchoolInput[],
        entityMaps: UpdateSchoolEntityMap
    ) {
        const organizationIds: string[] = []
        for (const c of entityMaps.mainEntity.values()) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await c.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }
        // eslint-disable-next-line no-await-in-loop
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: UpdateSchoolInput[],
        entityMaps: UpdateSchoolEntityMap
    ): {
        validInputs: { index: number; input: UpdateSchoolInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.id),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate(
        index: number,
        currentEntity: School,
        currentInput: UpdateSchoolInput,
        maps: UpdateSchoolEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, name, shortCode } = currentInput

        const matchingOrgAndName = maps.matchingOrgsAndNames.get(
            [organizationId, name].toString()
        )
        const matchingOrgAndShortcode = maps.matchingOrgsAndShortcodes.get(
            [organizationId, shortCode].toString()
        )

        if (
            matchingOrgAndName &&
            matchingOrgAndName.school_id !== currentEntity.school_id
        ) {
            errors.push(
                createEntityAPIError(
                    'existentChild',
                    index,
                    'School',
                    name,
                    'Organization',
                    organizationId,
                    ['organizationId', 'name']
                )
            )
        }
        if (
            matchingOrgAndShortcode &&
            matchingOrgAndShortcode.school_id !== currentEntity.school_id
        ) {
            errors.push(
                createEntityAPIError(
                    'existentChild',
                    index,
                    'School',
                    shortCode,
                    'Organization',
                    organizationId,
                    ['organizationId', 'shortCode']
                )
            )
        }
        return errors
    }

    protected process(
        currentInput: UpdateSchoolInput,
        entityMaps: UpdateSchoolEntityMap,
        index: number
    ) {
        const currentEntity = entityMaps.mainEntity.get(
            this.mainEntityIds[index]
        )!

        const { name, shortCode } = currentInput
        currentEntity.school_name = name
        currentEntity.shortcode =
            formatShortCode(
                shortCode,
                config.limits.SCHOOL_SHORTCODE_MAX_LENGTH
            ) || currentEntity.shortcode
        return { outputEntity: currentEntity }
    }

    protected async buildOutput(outputEntity: School): Promise<void> {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(outputEntity)
        )
    }
}

export class DeleteSchools extends DeleteMutation<
    School,
    DeleteSchoolInput,
    SchoolsMutationResult
> {
    protected readonly EntityType = School
    protected readonly EntityPrimaryKey = School
    protected readonly inputTypeName = 'DeleteSchoolInput'
    protected readonly mainEntityIds: string[]
    protected readonly output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: DeleteSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(): Promise<DeleteEntityMap<School>> {
        const categories = await School.createQueryBuilder()
            .select([
                ...schoolConnectionNodeFields,
                'Organization.organization_id',
            ])
            .leftJoin('School.organization', 'Organization')
            .where('School.school_id IN (:...ids)', { ids: this.mainEntityIds })
            .getMany()
        return { mainEntity: new Map(categories.map((c) => [c.school_id, c])) }
    }

    protected async authorize(
        _input: DeleteSchoolInput[],
        entityMaps: DeleteEntityMap<School>
    ) {
        const organizationIds: string[] = []
        for (const c of entityMaps.mainEntity.values()) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await c.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_school_20440
        )
    }

    protected async buildOutput(currentEntity: School): Promise<void> {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

export interface AddUsersToSchoolsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    users: Map<string, User>
    memberships: SchoolMembershipMap
    roles: Map<string, Role>
}

export class AddUsersToSchools extends AddMembershipMutation<
    School,
    AddUsersToSchoolInput,
    SchoolsMutationResult,
    AddUsersToSchoolsEntityMap,
    SchoolMembership
> {
    protected readonly EntityType = School
    protected readonly inputTypeName = 'AddUsersToSchoolInput'
    protected readonly output: SchoolsMutationResult = { schools: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: AddUsersToSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    validationOverAllInputs(
        inputs: AddUsersToSchoolInput[],
        entityMaps: AddUsersToSchoolsEntityMap
    ) {
        const schoolsErrorMap = validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.schoolId),
            this.EntityType.name,
            this.inputTypeName
        )
        const roleIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'schoolRoleIds'
        )

        const userIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'userIds'
        )

        return filterInvalidInputs(
            inputs,
            [schoolsErrorMap, roleIdsErrorMap, userIdsErrorMap].flat()
        )
    }

    async generateEntityMaps(
        input: AddUsersToSchoolInput[]
    ): Promise<AddUsersToSchoolsEntityMap> {
        const userIds = input.map((val) => val.userIds).flat()
        const schoolsPromise = getMap.school(this.mainEntityIds, [
            'organization',
        ])
        const usersPromise = getMap.user(userIds)
        const rolesPromise = getMap.role(
            input.flatMap((val) => val.schoolRoleIds ?? [])
        )
        const membershipsPromise = getMap.membership.school(
            this.mainEntityIds,
            userIds
        )

        return {
            mainEntity: await schoolsPromise,
            users: await usersPromise,
            memberships: await membershipsPromise,
            roles: await rolesPromise,
        }
    }

    async authorize(
        input: AddUsersToSchoolInput[],
        maps: AddUsersToSchoolsEntityMap
    ) {
        const orgIds = await Promise.all(
            input
                .map((i) =>
                    maps.mainEntity
                        .get(i.schoolId)
                        ?.organization?.then((o) => o.organization_id)
                )
                .filter((op): op is Promise<string> => op !== undefined)
        )

        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: orgIds,
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    validate(
        index: number,
        currentEntity: School,
        currentInput: AddUsersToSchoolInput,
        maps: AddUsersToSchoolsEntityMap
    ): APIError[] {
        const errors: APIError[] = []

        const users = flagNonExistent(
            User,
            index,
            currentInput.userIds,
            maps.users
        )
        const roles = flagNonExistent(
            Role,
            index,
            currentInput.schoolRoleIds ?? [],
            maps.roles
        )
        const memberships = flagExistentSchoolMembership(
            index,
            currentInput.schoolId,
            currentInput.userIds,
            maps.memberships
        )

        errors.push(...roles.errors, ...users.errors, ...memberships.errors)

        return errors
    }

    process(
        currentInput: AddUsersToSchoolInput,
        maps: AddUsersToSchoolsEntityMap,
        index: number
    ): ProcessedResult<School, SchoolMembership> {
        const memberships: SchoolMembership[] = []
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        for (const userId of currentInput.userIds) {
            const membership = new SchoolMembership()
            membership.school_id = currentEntity.school_id
            membership.school = Promise.resolve(currentEntity)
            membership.user_id = userId
            membership.user = Promise.resolve(maps.users.get(userId) as User)
            membership.roles = Promise.resolve(
                currentInput.schoolRoleIds?.map(
                    (r) => maps.roles.get(r) as Role
                ) ?? []
            )
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, modifiedEntity: memberships }
    }

    async buildOutput(currentEntity: School): Promise<void> {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

export interface RemoveUsersFromSchoolsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    users: Map<string, User>
    memberships: Map<string, SchoolMembership>
    organizations: Map<string, Organization>
}

export class RemoveUsersFromSchools extends RemoveMembershipMutation<
    School,
    RemoveUsersFromSchoolInput,
    SchoolsMutationResult,
    RemoveUsersFromSchoolsEntityMap,
    SchoolMembership
> {
    protected readonly EntityType = School
    protected readonly MembershipType = SchoolMembership
    protected inputTypeName = 'RemoveUsersFromSchoolInput'
    protected output: SchoolsMutationResult = { schools: [] }
    protected mainEntityIds: string[]
    protected readonly saveIds: Record<string, string>[]

    constructor(
        input: RemoveUsersFromSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
        this.saveIds = input.flatMap((i) =>
            i.userIds.map((user_id) => {
                return {
                    user_id,
                    school_id: i.schoolId,
                }
            })
        )
    }

    generateEntityMaps = async (
        input: RemoveUsersFromSchoolInput[]
    ): Promise<RemoveUsersFromSchoolsEntityMap> =>
        generateMapsForRemoveUsers(this.mainEntityIds, input)

    protected async authorize(
        _input: RemoveUsersFromSchoolInput[],
        maps: RemoveUsersFromSchoolsEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: RemoveUsersFromSchoolInput[],
        entityMaps: RemoveUsersFromSchoolsEntityMap
    ): {
        validInputs: { index: number; input: RemoveUsersFromSchoolInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.schoolId),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate(
        index: number,
        currentEntity: School,
        currentInput: RemoveUsersFromSchoolInput,
        maps: RemoveUsersFromSchoolsEntityMap
    ): APIError[] {
        // Retrieval
        const errors: APIError[] = []
        const { schoolId, userIds } = currentInput

        const uniqueUserIds = new Set(userIds)

        if (uniqueUserIds.size < userIds.length) {
            errors.push(
                createDuplicateAttributeAPIError(
                    index,
                    ['userIds'],
                    'RemoveUsersFromSchoolInput'
                )
            )
        }

        for (const userId of userIds) {
            // User validation
            const user = maps.users.get(userId)

            if (!user) {
                errors.push(
                    createEntityAPIError('nonExistent', index, 'User', userId)
                )

                continue
            }

            // Membership validation
            if (!maps.memberships.has([schoolId, userId].toString())) {
                errors.push(
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'User',
                        user.user_name() || user.user_id,
                        'School',
                        currentEntity.school_name || schoolId,
                        ['school_id', 'user_id']
                    )
                )
            }
        }

        return errors
    }

    protected process(
        currentInput: RemoveUsersFromSchoolInput,
        maps: RemoveUsersFromSchoolsEntityMap,
        index: number
    ) {
        const { schoolId, userIds } = currentInput
        const memberships: SchoolMembership[] = []

        const currentEntity = maps.mainEntity!.get(this.mainEntityIds[index])!

        for (const userId of userIds) {
            const membership = maps.memberships.get(
                [schoolId, userId].toString()
            )!

            Object.assign(membership, this.partialEntity)
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, others: memberships }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

export interface AddRemoveClassesToFromSchoolsEntityMap
    extends EntityMap<School> {
    mainEntity: Map<string, School>
    classes: Map<string, Class>
    schoolsClasses: Map<string, Class[]>
}

export class AddClassesToSchools extends AddMutation<
    School,
    AddClassesToSchoolInput,
    SchoolsMutationResult,
    AddRemoveClassesToFromSchoolsEntityMap
> {
    protected readonly EntityType = School
    protected inputTypeName = 'AddClassesToSchoolInput'
    protected mainEntityIds: string[]
    protected output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: AddClassesToSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    generateEntityMaps = async (
        input: AddClassesToSchoolInput[]
    ): Promise<AddRemoveClassesToFromSchoolsEntityMap> =>
        generateMapsForAddingOrRemovingClasses(this.mainEntityIds, input)

    protected async authorize(
        input: AddClassesToSchoolInput[],
        maps: AddRemoveClassesToFromSchoolsEntityMap
    ): Promise<void> {
        const orgIdPromises = input
            .map((i) =>
                maps.mainEntity
                    .get(i.schoolId)
                    ?.organization?.then((o) => o?.organization_id)
            )
            .filter((op): op is Promise<string> => op !== undefined)

        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: await Promise.all(orgIdPromises),
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: AddClassesToSchoolInput[],
        entityMaps: AddRemoveClassesToFromSchoolsEntityMap
    ): {
        validInputs: { index: number; input: AddClassesToSchoolInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.schoolId),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: AddClassesToSchoolInput,
        maps: AddRemoveClassesToFromSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId: itemId, classIds: subitemIds } = currentInput
        const mainEntityName = 'School'
        const subEntityName = 'Class'
        const mainEntityKeyName = 'school_id'
        const subEntityKeyName = 'class_id'

        const schoolClasses = new Set(
            maps.schoolsClasses.get(itemId)?.map((p) => p.class_id)
        )
        const schoolOrganizationId = maps.mainEntity.get(itemId)?.organizationId

        for (const subitemId of subitemIds) {
            const subitem = maps.classes.get(subitemId)
            if (!subitem) {
                errors.push(
                    createEntityAPIError(
                        'nonExistent',
                        index,
                        subEntityName,
                        subitemId
                    )
                )
            }
            if (!subitem) continue
            if (subitem.organizationId != schoolOrganizationId) {
                errors.push(
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: subEntityName,
                        entityName: subEntityName,
                        attribute: 'ID',
                        otherAttribute: subitemId,
                        index,
                    })
                )
            }
            const itemHasSubitem = schoolClasses.has(subitemId)
            if (itemHasSubitem) {
                errors.push(
                    createEntityAPIError(
                        'existentChild',
                        index,
                        subEntityName,
                        subitem[subEntityKeyName],
                        mainEntityName,
                        currentEntity[mainEntityKeyName]
                    )
                )
            }
        }
        return errors
    }

    protected process(
        currentInput: AddClassesToSchoolInput,
        maps: AddRemoveClassesToFromSchoolsEntityMap,
        index: number
    ) {
        const { schoolId: itemId, classIds: subitemIds } = currentInput

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const newSubitems: Class[] = []
        for (const subitemId of subitemIds) {
            const subitem = maps.classes.get(subitemId)!
            newSubitems.push(subitem)
        }
        const preExistentSubitems = maps.schoolsClasses.get(itemId)!
        currentEntity.classes = Promise.resolve([
            ...preExistentSubitems,
            ...newSubitems,
        ])
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

interface AddRemoveSchoolProgramsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    programs: Map<string, Program>
    schoolPrograms: Map<string, Program[]>
    orgIdList: string[]
}
type AddProgramsToSchoolsEntityMap = AddRemoveSchoolProgramsEntityMap
type RemoveProgramsFromSchoolsEntityMap = AddRemoveSchoolProgramsEntityMap

export class AddProgramsToSchools extends AddMutation<
    School,
    AddProgramsToSchoolInput,
    SchoolsMutationResult,
    AddProgramsToSchoolsEntityMap
> {
    protected readonly EntityType = School
    protected inputTypeName = 'AddProgramsToSchoolInput'
    protected mainEntityIds: string[]
    protected output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: AddProgramsToSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    generateEntityMaps = async (
        input: AddProgramsToSchoolInput[]
    ): Promise<AddProgramsToSchoolsEntityMap> =>
        generateMapsForAddingRemovingPrograms(input)

    protected async authorize(
        _input: AddProgramsToSchoolInput[],
        maps: AddProgramsToSchoolsEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: maps.orgIdList,
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: AddProgramsToSchoolInput[],
        entityMaps: AddProgramsToSchoolsEntityMap
    ): {
        validInputs: { index: number; input: AddProgramsToSchoolInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.schoolId),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate = (
        index: number,
        _: undefined,
        currentInput: AddProgramsToSchoolInput,
        maps: AddProgramsToSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId, programIds } = currentInput

        const programMap = maps.programs
        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...programs.errors)

        if (programs.errors.length) return errors
        const schoolProgramIds = new Set(
            maps.schoolPrograms.get(schoolId)?.map((p) => p.id)
        )
        const programChildErrors = flagExistentChild(
            School,
            Program,
            index,
            schoolId,
            programIds,
            schoolProgramIds
        )
        errors.push(...programChildErrors)

        return errors
    }

    protected process(
        currentInput: AddProgramsToSchoolInput,
        maps: AddProgramsToSchoolsEntityMap,
        index: number
    ) {
        const { schoolId: schoolId, programIds: programIds } = currentInput
        const school = maps.mainEntity.get(this.mainEntityIds[index])!

        const newPrograms: Program[] = []
        for (const programId of programIds) {
            const program = maps.programs.get(programId)!
            newPrograms.push(program)
        }

        const preexistentPrograms = maps.schoolPrograms.get(schoolId)!
        school.programs = Promise.resolve([
            ...preexistentPrograms,
            ...newPrograms,
        ])

        return { outputEntity: school }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

export class RemoveProgramsFromSchools extends AddMutation<
    School,
    RemoveProgramsFromSchoolInput,
    SchoolsMutationResult,
    RemoveProgramsFromSchoolsEntityMap
> {
    protected readonly EntityType = School
    protected inputTypeName = 'RemoveProgramsFromSchoolInput'
    protected mainEntityIds: string[]
    protected output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: RemoveProgramsFromSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    generateEntityMaps = async (
        input: RemoveProgramsFromSchoolInput[]
    ): Promise<RemoveProgramsFromSchoolsEntityMap> =>
        generateMapsForAddingRemovingPrograms(input)

    protected async authorize(
        _input: RemoveProgramsFromSchoolInput[],
        maps: RemoveProgramsFromSchoolsEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: maps.orgIdList,
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: RemoveProgramsFromSchoolInput[],
        entityMaps: RemoveProgramsFromSchoolsEntityMap
    ): {
        validInputs: { index: number; input: RemoveProgramsFromSchoolInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.schoolId),
                this.EntityType.name,
                this.inputTypeName
            )
        )
    }

    protected validate = (
        index: number,
        _: undefined,
        currentInput: RemoveProgramsFromSchoolInput,
        maps: RemoveProgramsFromSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId, programIds } = currentInput

        const programMap = maps.programs
        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...programs.errors)

        if (programs.errors.length) return errors
        const schoolProgramIds = new Set(
            maps.schoolPrograms.get(schoolId)?.map((p) => p.id)
        )
        const programChildErrors = flagNonExistentChild(
            School,
            Program,
            index,
            schoolId,
            programIds,
            schoolProgramIds
        )
        errors.push(...programChildErrors)

        return errors
    }

    protected process(
        currentInput: RemoveProgramsFromSchoolInput,
        maps: RemoveProgramsFromSchoolsEntityMap,
        index: number
    ) {
        const { schoolId, programIds } = currentInput

        const preexistentPrograms = maps.schoolPrograms.get(schoolId)!
        const newPrograms = preexistentPrograms.filter(
            (p) => !programIds.includes(p.id)
        )

        const school = maps.mainEntity.get(this.mainEntityIds[index])!

        school.programs = Promise.resolve(newPrograms)
        return { outputEntity: school }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

async function generateMapsForAddingRemovingPrograms(
    input: RemoveProgramsFromSchoolInput[]
): Promise<RemoveProgramsFromSchoolsEntityMap> {
    const schoolMap = getMap.school(
        input.map((i) => i.schoolId),
        ['programs', 'organization']
    )
    const programMap = getMap.program(input.flatMap((i) => i.programIds))

    const schoolPrograms = new Map<string, Program[]>()
    for (const school of (await schoolMap).values()) {
        // eslint-disable-next-line no-await-in-loop
        schoolPrograms.set(school.school_id, (await school.programs) || [])
    }

    const orgIds = await Promise.all(
        Array.from((await schoolMap).values(), (school) =>
            school.organization?.then((org) => org?.organization_id)
        ).filter((id): id is Promise<string> => id !== undefined)
    )

    return {
        mainEntity: await schoolMap,
        programs: await programMap,
        schoolPrograms: schoolPrograms,
        orgIdList: orgIds,
    }
}

async function generateMapsForCreate(
    input: CreateSchoolInput[],
    organizationIds: string[]
): Promise<CreateSchoolEntityMap> {
    const {
        matchingOrgsAndNames,
        matchingOrgsAndShortcodes,
    } = await getMatchingEntities(organizationIds, input)

    const preloadedOrgArray = Organization.find({
        where: {
            status: Status.ACTIVE,
            organization_id: In(organizationIds),
        },
    })

    return {
        mainEntity: matchingOrgsAndNames,
        matchingOrgsAndShortcodes,
        organizations: new Map(
            (await preloadedOrgArray).map((i) => [i.organization_id, i])
        ),
    }
}

const getMatchingEntities = async (
    orgIds: string[],
    input: CreateSchoolInput[]
) => {
    const names = input.map((val) => val.name)
    const shortCodes = input.map((val) => val.shortCode)
    const statusAndOrgs = { status: Status.ACTIVE, organization: In(orgIds) }
    const matchingPreloadedSchoolArray = School.find({
        where: [
            {
                school_name: In(names),
                ...statusAndOrgs,
            },
            {
                shortcode: In(shortCodes),
                ...statusAndOrgs,
            },
        ],
        relations: ['organization'],
    })

    const matchingOrgsAndNames = new Map<string, School>()
    const matchingOrgsAndShortcodes = new Map<string, School>()
    for (const s of await matchingPreloadedSchoolArray) {
        // eslint-disable-next-line no-await-in-loop
        const orgId = (await s.organization)?.organization_id || ''
        matchingOrgsAndNames.set([orgId, s.school_name].toString(), s)
        matchingOrgsAndShortcodes.set([orgId, s.shortcode].toString(), s)
    }
    return { matchingOrgsAndNames, matchingOrgsAndShortcodes }
}

async function generateMapsForRemoveUsers(
    schoolIds: string[],
    input: {
        userIds: string[]
        schoolRoleIds?: string[]
    }[]
) {
    const preloadedSchoolArray = School.findByIds(schoolIds, {
        where: { status: Status.ACTIVE },
    })

    const preloadedUserArray = User.findByIds(
        input.map((i) => i.userIds).flat(),
        { where: { status: Status.ACTIVE } }
    )

    const preloadedMembershipArray = SchoolMembership.find({
        where: {
            user_id: In(input.map((i) => i.userIds).flat()),
            school_id: In(schoolIds),
            status: Status.ACTIVE,
        },
    })

    const preloadedOrganizationArray = Organization.find({
        join: {
            alias: 'Organization',
            innerJoin: {
                schools: 'Organization.schools',
            },
        },
        where: (qb: WhereExpression) => {
            qb.where('schools.school_id IN (:...schoolIds)', { schoolIds })
        },
    })

    return {
        mainEntity: new Map(
            (await preloadedSchoolArray).map((i) => [i.school_id, i])
        ),
        users: new Map((await preloadedUserArray).map((i) => [i.user_id, i])),
        memberships: new Map(
            (await preloadedMembershipArray).map((i) => [
                [i.school_id, i.user_id].toString(),
                i,
            ])
        ),
        organizations: new Map(
            (await preloadedOrganizationArray).map((i) => [
                i.organization_id,
                i,
            ])
        ),
    }
}

async function generateMapsForAddingOrRemovingClasses(
    itemIds: string[],
    input: AddClassesToSchoolInput[] | RemoveClassesFromSchoolInput[]
): Promise<AddRemoveClassesToFromSchoolsEntityMap> {
    const schoolIds = itemIds
    const schoolMap = getMap.school(schoolIds, ['organization'])
    const classMap = getMap.class(input.flatMap((i) => i.classIds))
    const schoolsClasses = new Map<string, Class[]>()
    for (const [, school] of await schoolMap) {
        // eslint-disable-next-line no-await-in-loop
        const classes = (await school.classes) || []
        schoolsClasses.set(school['school_id'], classes)
    }

    return {
        mainEntity: await schoolMap,
        classes: await classMap,
        schoolsClasses,
    }
}

export class RemoveClassesFromSchools extends RemoveMutation<
    School,
    RemoveClassesFromSchoolInput,
    SchoolsMutationResult,
    EntityMap<School>
> {
    protected readonly EntityType = School
    protected inputTypeName = 'RemoveClassesFromSchoolInput'
    protected mainEntityIds: string[]
    protected output: SchoolsMutationResult = { schools: [] }

    constructor(
        input: RemoveClassesFromSchoolInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    generateEntityMaps = async (
        input: RemoveClassesFromSchoolInput[]
    ): Promise<EntityMap<School>> =>
        generateMapsForAddingOrRemovingClasses(this.mainEntityIds, input)

    protected async authorize(
        input: RemoveClassesFromSchoolInput[],
        maps: AddRemoveClassesToFromSchoolsEntityMap
    ): Promise<void> {
        const orgIdPromises = input
            .map((i) =>
                maps.mainEntity
                    .get(i.schoolId)
                    ?.organization?.then((o) => o?.organization_id)
            )
            .filter((op): op is Promise<string> => op !== undefined)

        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: await Promise.all(orgIdPromises),
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: RemoveClassesFromSchoolInput[]
    ): {
        validInputs: { index: number; input: RemoveClassesFromSchoolInput }[]
        apiErrors: APIError[]
    } {
        const schoolIds = inputs.map((val) => val.schoolId)

        const validateNoDup = validateNoDuplicates(
            inputs,
            schoolIds,
            this.inputTypeName
        )

        const validateSubItems = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'classIds'
        )

        return filterInvalidInputs(inputs, [
            ...validateNoDup,
            ...validateSubItems,
        ])
    }

    protected validate = (
        index: number,
        _currentEntity: School,
        currentInput: RemoveClassesFromSchoolInput,
        maps: AddRemoveClassesToFromSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId, classIds } = currentInput
        const classMap = maps.classes

        const school = flagNonExistent(
            School,
            index,
            [schoolId],
            maps.mainEntity
        )

        errors.push(...school.errors)

        const _class = flagNonExistent(Class, index, classIds, classMap)
        errors.push(..._class.errors)

        if (!school.values.length || !_class.values.length) return errors
        const schoolClassIds = new Set(
            maps.schoolsClasses.get(schoolId)?.map((p) => p.class_id)
        )

        const schoolChildErrors = flagNonExistentChild(
            School,
            Class,
            index,
            schoolId,
            _class.values.map((c) => c.class_id),
            schoolClassIds
        )

        errors.push(...schoolChildErrors)

        return errors
    }

    protected process(
        currentInput: RemoveClassesFromSchoolInput,
        maps: AddRemoveClassesToFromSchoolsEntityMap,
        index: number
    ) {
        const { schoolId, classIds } = currentInput

        const preexistentClasses: Class[] = maps.schoolsClasses.get(schoolId)!
        const classes = preexistentClasses.filter(
            (_class) => !classIds.includes(_class.class_id)
        )

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        currentEntity.classes = Promise.resolve(classes)
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}
