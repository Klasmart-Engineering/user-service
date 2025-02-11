import { In } from 'typeorm'
import { Organization } from '../entities/organization'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { Status } from '../entities/status'
import { User } from '../entities/user'
import { Context } from '../main'
import { mapSchoolToSchoolConnectionNode } from '../pagination/schoolsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateSchoolInput,
    DeleteSchoolInput,
    SchoolsMutationResult,
    AddClassesToSchoolInput,
    UpdateSchoolInput,
    AddProgramsToSchoolInput,
    RemoveProgramsFromSchoolInput,
    AddUsersToSchoolInput,
    RemoveClassesFromSchoolInput,
    RemoveUsersFromSchoolInput,
    DeleteUsersFromSchoolInput,
    ReactivateUsersFromSchoolInput,
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
    validateNoDuplicate,
} from '../utils/resolvers/commonStructure'
import { Class } from '../entities/class'
import {
    createClassHasAcademicTermAPIError,
    createEntityAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers/errors'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import { config } from '../config/config'
import {
    getMap,
    OrganizationMembershipMap,
    SchoolMembershipMap,
} from '../utils/resolvers/entityMaps'
import { Program } from '../entities/program'
import { Role } from '../entities/role'
import {
    flagExistentChild,
    flagExistentSchoolMembership,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
    validateSubItemsInOrg,
} from '../utils/resolvers/inputValidation'
import { customErrors } from '../types/errors/customError'
import logger from '../logging'
import { ObjMap } from '../utils/stringUtils'
import { uniqueAndTruthy } from '../utils/clean'

export interface CreateSchoolEntityMap extends EntityMap<School> {
    matchingOrgsAndNames: Map<string, School>
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

    async generateEntityMaps(
        input: CreateSchoolInput[]
    ): Promise<CreateSchoolEntityMap> {
        return {
            ...(await getMatchingEntities(this.orgIds, input)),
            organizations: await getMap.organization(this.orgIds),
        }
    }

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

        const schoolExist = maps.matchingOrgsAndNames.get(
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
        const schoolConnectionNode = mapSchoolToSchoolConnectionNode(
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
            where: { school_id: In(this.mainEntityIds) },
        })

        const matchingPreloadedSchoolArray = School.find({
            where: [{ school_name: In(names) }, { shortcode: In(shortCodes) }],
        })

        const matchingOrgsAndNames = new Map<string, School>()
        const matchingOrgsAndShortcodes = new Map<string, School>()
        for (const s of await matchingPreloadedSchoolArray) {
            const orgId = s.organization_id || ''
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

    protected authorize(
        _input: UpdateSchoolInput[],
        entityMaps: UpdateSchoolEntityMap
    ) {
        const organizationIds = uniqueAndTruthy(
            Array.from(entityMaps.mainEntity.values()).map(
                (s) => s.organization_id
            )
        )
        return this.permissions.rejectIfNotAllowed(
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
        this.output.schools.push(mapSchoolToSchoolConnectionNode(outputEntity))
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
        return { mainEntity: await getMap.school(this.mainEntityIds) }
    }

    protected authorize(
        _input: DeleteSchoolInput[],
        entityMaps: DeleteEntityMap<School>
    ) {
        const organizationIds = uniqueAndTruthy(
            Array.from(entityMaps.mainEntity.values()).map(
                (s) => s.organization_id
            )
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_school_20440
        )
    }

    protected async buildOutput(currentEntity: School): Promise<void> {
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
    }
}

export interface AddUsersToSchoolsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    users: Map<string, User>
    schoolMemberships: SchoolMembershipMap
    roles: Map<string, Role>
    orgMemberships: OrganizationMembershipMap
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

    validationOverAllInputs(inputs: AddUsersToSchoolInput[]) {
        const schoolsErrorMap = validateNoDuplicate(
            inputs.map((val) => val.schoolId),
            this.inputTypeName,
            ['schoolId']
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
        const schoolsPromise = getMap.school(this.mainEntityIds)
        const usersPromise = getMap.user(userIds)
        const rolesPromise = getMap.role(
            input.flatMap((val) => val.schoolRoleIds ?? [])
        )
        const schoolMembershipsPromise = getMap.membership.school(
            this.mainEntityIds,
            userIds
        )
        const orgMembershipsPromise = schoolsPromise
            .then((schoolMap) => Array.from(schoolMap.values()))
            .then((schools) => schools.map((s) => s.organization_id))
            .then(uniqueAndTruthy)
            .then((orgIds) => getMap.membership.organization(orgIds, userIds))

        return {
            mainEntity: await schoolsPromise,
            users: await usersPromise,
            schoolMemberships: await schoolMembershipsPromise,
            roles: await rolesPromise,
            orgMemberships: await orgMembershipsPromise,
        }
    }

    authorize(
        _input: AddUsersToSchoolInput[],
        maps: AddUsersToSchoolsEntityMap
    ) {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: organizationIds,
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    validate(
        index: number,
        _currentEntity: School,
        { schoolId, userIds, schoolRoleIds }: AddUsersToSchoolInput,
        maps: AddUsersToSchoolsEntityMap
    ): APIError[] {
        const errors: APIError[] = []

        const school = flagNonExistent(
            School,
            index,
            [schoolId],
            maps.mainEntity
        )
        const users = flagNonExistent(User, index, userIds, maps.users)
        const roles = flagNonExistent(
            Role,
            index,
            schoolRoleIds ?? [],
            maps.roles
        )
        errors.push(...school.errors, ...users.errors, ...roles.errors)

        if (school.errors.length || users.errors.length) return errors

        const schoolMemberships = flagExistentSchoolMembership(
            index,
            schoolId,
            userIds,
            maps.schoolMemberships
        )
        errors.push(...schoolMemberships.errors)

        const { organization_id } = school.values[0]
        const orgMemberships = flagNonExistentOrganizationMembership(
            index,
            organization_id || '',
            userIds,
            maps.orgMemberships
        )
        errors.push(...orgMemberships.errors)

        return errors
    }

    process(
        currentInput: AddUsersToSchoolInput,
        maps: AddUsersToSchoolsEntityMap,
        index: number
    ): ProcessedResult<School, SchoolMembership> {
        const memberships: SchoolMembership[] = []
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const statusUpdatedAt = new Date()
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
            membership.status_updated_at = statusUpdatedAt
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, modifiedEntity: memberships }
    }

    async buildOutput(currentEntity: School): Promise<void> {
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
    }
}

export interface ChangeSchoolMembershipStatusEntityMap
    extends EntityMap<School> {
    mainEntity: Map<string, School>
    users: Map<string, User>
    memberships: ObjMap<{ schoolId: string; userId: string }, SchoolMembership>
}

type ChangeSchoolMembershipStatusInput = { schoolId: string; userIds: string[] }

export abstract class ChangeSchoolMembershipStatus extends RemoveMembershipMutation<
    School,
    ChangeSchoolMembershipStatusInput,
    SchoolsMutationResult,
    ChangeSchoolMembershipStatusEntityMap,
    SchoolMembership
> {
    protected readonly EntityType = School
    protected readonly MembershipType = SchoolMembership
    protected output: SchoolsMutationResult = { schools: [] }
    protected mainEntityIds: string[]

    constructor(
        input: ChangeSchoolMembershipStatusInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    abstract generateEntityMaps(
        input: ChangeSchoolMembershipStatusInput[]
    ): Promise<ChangeSchoolMembershipStatusEntityMap>

    validationOverAllInputs(
        inputs: ChangeSchoolMembershipStatusInput[]
    ): {
        validInputs: {
            index: number
            input: ChangeSchoolMembershipStatusInput
        }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            validateNoDuplicate(
                inputs.map((val) => val.schoolId),
                this.inputTypeName,
                ['schoolId']
            ),
            ...validateSubItemsLengthAndNoDuplicates(
                inputs,
                this.inputTypeName,
                'userIds'
            ),
        ])
    }

    validate(
        index: number,
        _currentEntity: School,
        currentInput: ChangeSchoolMembershipStatusInput,
        maps: ChangeSchoolMembershipStatusEntityMap
    ): APIError[] {
        // Retrieval
        const errors: APIError[] = []
        const { schoolId, userIds } = currentInput

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
            if (!maps.memberships.has({ schoolId, userId })) {
                errors.push(
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'User',
                        user.user_id,
                        'School',
                        schoolId
                    )
                )
            }
        }

        return errors
    }

    process(
        currentInput: ChangeSchoolMembershipStatusInput,
        maps: ChangeSchoolMembershipStatusEntityMap,
        index: number
    ): {
        outputEntity: School
        modifiedEntity: SchoolMembership[]
    } {
        const { schoolId, userIds } = currentInput
        const memberships: SchoolMembership[] = []

        const currentEntity = maps.mainEntity!.get(this.mainEntityIds[index])!

        for (const userId of userIds) {
            const membership = maps.memberships.get({ schoolId, userId })!

            Object.assign(membership, this.partialEntity)
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, modifiedEntity: memberships }
    }

    protected async applyToDatabase(
        results: ProcessedResult<School, SchoolMembership>[]
    ) {
        await super.applyToDatabase(results)
        for (const result of results) {
            logger.info(
                `${
                    this.inputTypeName
                }: ${this.permissions.getUserId()} on users ${result.modifiedEntity?.map(
                    (m) => m.user_id
                )} of school ${result.outputEntity.school_id}`
            )
        }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
    }
}

export class ReactivateUsersFromSchools extends ChangeSchoolMembershipStatus {
    protected inputTypeName = 'reactivateUsersFromSchoolInput'
    protected readonly partialEntity = {
        status: Status.ACTIVE,
        status_updated_at: new Date(),
    }

    authorize(
        _input: ReactivateUsersFromSchoolInput[],
        maps: ChangeSchoolMembershipStatusEntityMap
    ): Promise<void> {
        const orgIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: orgIds, school_ids: this.mainEntityIds },
            PermissionName.reactivate_my_school_user_40886
        )
    }

    generateEntityMaps(
        input: ReactivateUsersFromSchoolInput[]
    ): Promise<ChangeSchoolMembershipStatusEntityMap> {
        return generateMapsForRemoveUsers(this.mainEntityIds, input, [
            Status.INACTIVE,
        ])
    }
}

export class RemoveUsersFromSchools extends ChangeSchoolMembershipStatus {
    protected inputTypeName = 'removeUsersFromSchoolInput'
    protected readonly partialEntity = {
        status: Status.INACTIVE,
        status_updated_at: new Date(),
    }

    authorize(
        _input: RemoveUsersFromSchoolInput[],
        maps: ChangeSchoolMembershipStatusEntityMap
    ): Promise<void> {
        const orgIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: orgIds, school_ids: this.mainEntityIds },
            PermissionName.deactivate_my_school_user_40885
        )
    }

    generateEntityMaps(
        input: RemoveUsersFromSchoolInput[]
    ): Promise<ChangeSchoolMembershipStatusEntityMap> {
        return generateMapsForRemoveUsers(this.mainEntityIds, input, [
            Status.ACTIVE,
        ])
    }
}

export class DeleteUsersFromSchools extends ChangeSchoolMembershipStatus {
    protected inputTypeName = 'deleteUsersFromSchoolInput'
    protected readonly partialEntity = {
        status: Status.DELETED,
        status_updated_at: new Date(),
    }

    authorize(
        _input: DeleteUsersFromSchoolInput[],
        maps: ChangeSchoolMembershipStatusEntityMap
    ): Promise<void> {
        const orgIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: orgIds, school_ids: this.mainEntityIds },
            PermissionName.delete_my_school_users_40441
        )
    }

    generateEntityMaps(
        input: DeleteUsersFromSchoolInput[]
    ): Promise<ChangeSchoolMembershipStatusEntityMap> {
        return generateMapsForRemoveUsers(this.mainEntityIds, input, [
            Status.ACTIVE,
            Status.INACTIVE,
        ])
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

    protected authorize(
        _input: AddClassesToSchoolInput[],
        maps: AddRemoveClassesToFromSchoolsEntityMap
    ): Promise<void> {
        const orgIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: orgIds, school_ids: this.mainEntityIds },
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
                this.inputTypeName,
                'schoolId'
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
        const { schoolId, classIds } = currentInput

        const schoolClasses = new Set(
            maps.schoolsClasses.get(schoolId)?.map((p) => p.class_id)
        )
        const schoolOrganizationId = maps.mainEntity.get(schoolId)
            ?.organization_id

        for (const classId of classIds) {
            const cls = maps.classes.get(classId)
            if (!cls) {
                errors.push(
                    createEntityAPIError('nonExistent', index, 'Class', classId)
                )
            }
            if (!cls) continue
            if (cls.organization_id != schoolOrganizationId) {
                errors.push(
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Class',
                        entityName: classId,
                        index,
                    })
                )
            }
            if (schoolClasses.has(classId)) {
                errors.push(
                    createEntityAPIError(
                        'existentChild',
                        index,
                        'Class',
                        cls['class_id'],
                        'School',
                        currentEntity['school_id']
                    )
                )
            }
            if (cls.academic_term_id) {
                errors.push(
                    createClassHasAcademicTermAPIError(cls.class_id, index)
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
        const { schoolId, classIds } = currentInput

        const school = maps.mainEntity.get(this.mainEntityIds[index])!

        const classes: Class[] = []
        for (const classId of classIds) {
            const subitem = maps.classes.get(classId)!
            classes.push(subitem)
        }
        const preExistentClasses = maps.schoolsClasses.get(schoolId)!
        school.classes = Promise.resolve([...preExistentClasses, ...classes])
        return { outputEntity: school }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
    }
}

interface AddRemoveSchoolProgramsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    programs: Map<string, Program>
    schoolPrograms: Map<string, Program[]>
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
        generateMapsForAddingRemovingPrograms(this.mainEntityIds, input)

    protected authorize(
        _input: AddProgramsToSchoolInput[],
        maps: AddProgramsToSchoolsEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: organizationIds,
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validationOverAllInputs(
        inputs: AddProgramsToSchoolInput[]
    ): {
        validInputs: { index: number; input: AddProgramsToSchoolInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            validateNoDuplicate(
                inputs.map((val) => val.schoolId),
                this.inputTypeName,
                ['schoolId']
            ),
        ])
    }

    protected validate = (
        index: number,
        _: undefined,
        currentInput: AddProgramsToSchoolInput,
        maps: AddProgramsToSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId, programIds } = currentInput

        const school = flagNonExistent(
            School,
            index,
            [schoolId],
            maps.mainEntity
        )

        const programMap = maps.programs
        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...school.errors, ...programs.errors)

        if (errors.length) return errors

        const programsNotInOrgError = validateSubItemsInOrg(
            Program,
            programIds,
            index,
            programMap,
            school.values[0].organization_id
        )
        errors.push(...programsNotInOrgError)

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
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
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
        generateMapsForAddingRemovingPrograms(this.mainEntityIds, input)

    protected authorize(
        _input: RemoveProgramsFromSchoolInput[],
        maps: RemoveProgramsFromSchoolsEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: organizationIds,
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
                this.inputTypeName,
                'schoolId'
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
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
    }
}

async function generateMapsForAddingRemovingPrograms(
    schoolIds: string[],
    input: RemoveProgramsFromSchoolInput[]
): Promise<AddRemoveSchoolProgramsEntityMap> {
    const programIds = input.flatMap((i) => i.programIds)
    const programs = getMap.program(programIds)
    const schools = await getMap.school(schoolIds, ['programs'])

    const schoolPrograms = new Map<string, Program[]>()
    for (const school of schools.values()) {
        // eslint-disable-next-line no-await-in-loop
        schoolPrograms.set(school.school_id, (await school.programs) || [])
    }

    return {
        mainEntity: schools,
        programs: await programs,
        schoolPrograms,
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
    })

    const matchingOrgsAndNames = new Map<string, School>()
    const matchingOrgsAndShortcodes = new Map<string, School>()
    for (const s of await matchingPreloadedSchoolArray) {
        // eslint-disable-next-line no-await-in-loop
        const orgId = s.organization_id || ''
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
    }[],
    membershipStatuses = [Status.ACTIVE]
): Promise<ChangeSchoolMembershipStatusEntityMap> {
    const preloadedUserArray = User.find({
        where: {
            user_id: In(input.map((i) => i.userIds).flat()),
            status: Status.ACTIVE,
        },
    })

    const preloadedSchoolArray = await getMap.school(schoolIds)

    const orgIds = await Promise.all(
        Array.from(preloadedSchoolArray.values(), (school) =>
            school.organization?.then((org) => org?.organization_id)
        ).filter((id): id is Promise<string> => id !== undefined)
    )

    return {
        mainEntity: preloadedSchoolArray,
        users: new Map((await preloadedUserArray).map((i) => [i.user_id, i])),
        memberships: await getMap.membership.school(
            schoolIds,
            input.flatMap((i) => i.userIds),
            undefined,
            membershipStatuses
        ),
        orgIds: orgIds,
    }
}

async function generateMapsForAddingOrRemovingClasses(
    itemIds: string[],
    input: AddClassesToSchoolInput[] | RemoveClassesFromSchoolInput[]
): Promise<AddRemoveClassesToFromSchoolsEntityMap> {
    const schoolIds = itemIds
    const schoolMap = getMap.school(schoolIds)
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

    protected authorize(
        _input: RemoveClassesFromSchoolInput[],
        maps: AddRemoveClassesToFromSchoolsEntityMap
    ): Promise<void> {
        const orgIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((s) => s.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: orgIds, school_ids: this.mainEntityIds },
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

        const validateNoDup = validateNoDuplicate(
            schoolIds,
            this.inputTypeName,
            ['schoolId']
        )

        const validateSubItems = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'classIds'
        )

        return filterInvalidInputs(inputs, [validateNoDup, ...validateSubItems])
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

        for (const cls of _class.values) {
            if (cls.academic_term_id) {
                errors.push(
                    createClassHasAcademicTermAPIError(cls.class_id, index)
                )
            }
        }

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

        const school = maps.mainEntity.get(this.mainEntityIds[index])!
        school.classes = Promise.resolve(classes)
        return { outputEntity: school }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(mapSchoolToSchoolConnectionNode(currentEntity))
    }
}
