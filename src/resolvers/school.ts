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
} from '../types/graphQL/school'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    AddMutation,
    UpdateMutation,
    RemoveMembershipMutation,
    DeleteEntityMap,
    validateActiveAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { Class } from '../entities/class'
import {
    createEntityAPIError,
    createDuplicateAttributeAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers/errors'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import { config } from '../config/config'
import { getMembershipMapKey } from '../utils/resolvers/entityMaps'
import { Program } from '../entities/program'

export interface CreateSchoolEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    matchingOrgsAndShortcodes: Map<string, School>
    organizations: Map<string, Organization>
}
export class CreateSchools extends CreateMutation<
    School,
    CreateSchoolInput,
    SchoolsMutationResult
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
    SchoolsMutationResult
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
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.id),
            this.EntityType.name,
            this.inputTypeName
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
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.schoolId),
            this.EntityType.name,
            this.inputTypeName
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

export interface AddClassesToSchoolsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    organizations: Map<string, Organization>
    subitems: Map<string, Class>
    itemsSubitems: Map<string, Class>
    itemsWithExistentSubitems: Map<string, Class[]>
}

export class AddClassesToSchools extends AddMutation<
    School,
    AddClassesToSchoolInput,
    SchoolsMutationResult
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
    ): Promise<AddClassesToSchoolsEntityMap> =>
        generateMapsForAddingClasses(this.mainEntityIds, input)

    protected async authorize(
        _input: AddClassesToSchoolInput[],
        maps: AddClassesToSchoolsEntityMap
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
        inputs: AddClassesToSchoolInput[],
        entityMaps: AddClassesToSchoolsEntityMap
    ): {
        validInputs: { index: number; input: AddClassesToSchoolInput }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.schoolId),
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: AddClassesToSchoolInput,
        maps: AddClassesToSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId: itemId, classIds: subitemIds } = currentInput
        const mainEntityName = 'School'
        const subEntityName = 'Class'
        const mainEntityKeyName = 'school_name'
        const subEntityKeyName = 'class_name'

        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId)
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

            const itemHasSubitem = maps.itemsSubitems.has(
                getMembershipMapKey(itemId, subitemId)
            )

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
        maps: AddClassesToSchoolsEntityMap,
        index: number
    ) {
        const { schoolId: itemId, classIds: subitemIds } = currentInput

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const newSubitems: Class[] = []
        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId)!
            newSubitems.push(subitem)
        }
        const preExistentSubitems = maps.itemsWithExistentSubitems.get(itemId)!
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

export interface AddProgramsToSchoolsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    organizations: Map<string, Organization>
    subitems: Map<string, Program>
    itemsSubitems: Map<string, Program>
    itemsWithExistentSubitems: Map<string, Program[]>
}

export class AddProgramsToSchools extends AddMutation<
    School,
    AddProgramsToSchoolInput,
    SchoolsMutationResult
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

    async generateEntityMaps(
        input: AddProgramsToSchoolInput[]
    ): Promise<AddProgramsToSchoolsEntityMap> {
        const itemIds = this.mainEntityIds
        const relations = 'programs'
        const addingIds = 'programIds'
        const mainEntityName = 'School'
        const mainItemId = 'school_id'
        const subitemId = 'id'

        const preloadedItemArray = School.findByIds(itemIds, {
            where: { status: Status.ACTIVE },
            relations: [relations],
        })
        const preloadedSubitemsArray = Program.findByIds(
            input.map((val) => val[addingIds]).flat(),
            { where: { status: Status.ACTIVE } }
        )
        const itemsWithExistentSubitems = new Map<string, Program[]>()
        const itemsSubitems = new Map<string, Program>()
        for (const item of await preloadedItemArray) {
            // eslint-disable-next-line no-await-in-loop
            const subitems = (await item.programs) || []
            itemsWithExistentSubitems.set(item[mainItemId], subitems)
            if (subitems.length > 0) {
                for (const subitem of subitems) {
                    itemsSubitems.set(
                        getMembershipMapKey(
                            item[mainItemId],
                            subitem[subitemId]
                        ),
                        subitem
                    )
                }
            }
        }

        const preloadedOrganizationArray = Organization.createQueryBuilder()
            .select('Organization.organization_id')
            .innerJoin(`Organization.schools`, mainEntityName)
            .where(`"${mainEntityName}"."${mainItemId}" IN (:...itemIds)`, {
                itemIds,
            })
            .getMany()

        return {
            mainEntity: new Map(
                (await preloadedItemArray).map((i) => [i[mainItemId], i])
            ),
            subitems: new Map(
                (await preloadedSubitemsArray).map((i) => [i[subitemId], i])
            ),
            itemsSubitems,
            itemsWithExistentSubitems,
            organizations: new Map(
                (await preloadedOrganizationArray).map((i) => [
                    i.organization_id,
                    i,
                ])
            ),
        }
    }

    protected async authorize(
        _input: AddProgramsToSchoolInput[],
        maps: AddProgramsToSchoolsEntityMap
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
        inputs: AddProgramsToSchoolInput[],
        entityMaps: AddProgramsToSchoolsEntityMap
    ): {
        validInputs: { index: number; input: AddProgramsToSchoolInput }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.schoolId),
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: AddProgramsToSchoolInput,
        maps: AddProgramsToSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId: itemId, programIds: subitemIds } = currentInput
        const mainEntityName = 'School'
        const subEntityName = 'Program'
        const mainEntityKeyName = 'school_name'
        const subEntityKeyName = 'name'

        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId)
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

            const itemHasSubitem = maps.itemsSubitems.has(
                getMembershipMapKey(itemId, subitemId)
            )

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
        currentInput: AddProgramsToSchoolInput,
        maps: AddProgramsToSchoolsEntityMap,
        index: number
    ) {
        const { schoolId: itemId, programIds: subitemIds } = currentInput

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const newSubitems: Program[] = []
        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId)!
            newSubitems.push(subitem)
        }
        const preExistentSubitems = maps.itemsWithExistentSubitems.get(itemId)!
        currentEntity.programs = Promise.resolve([
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

async function generateMapsForAddingClasses(
    itemIds: string[],
    input: AddClassesToSchoolInput[]
): Promise<AddClassesToSchoolsEntityMap> {
    const relations = 'classes'
    const addingIds = 'classIds'
    const mainEntityName = 'School'
    const mainItemId = 'school_id'
    const subitemId = 'class_id'

    const preloadedItemArray = School.findByIds(itemIds, {
        where: { status: Status.ACTIVE },
        relations: [relations],
    })
    const preloadedSubitemsArray = Class.findByIds(
        input.map((val) => val[addingIds]).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const itemsWithExistentSubitems = new Map<string, Class[]>()
    const itemsSubitems = new Map<string, Class>()
    for (const item of await preloadedItemArray) {
        // eslint-disable-next-line no-await-in-loop
        const subitems = (await item.classes) || []
        itemsWithExistentSubitems.set(item[mainItemId], subitems)
        if (subitems.length > 0) {
            for (const subitem of subitems) {
                itemsSubitems.set(
                    getMembershipMapKey(item[mainItemId], subitem[subitemId]),
                    subitem
                )
            }
        }
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin(`Organization.schools`, mainEntityName)
        .where(`"${mainEntityName}"."${mainItemId}" IN (:...itemIds)`, {
            itemIds,
        })
        .getMany()

    return {
        mainEntity: new Map(
            (await preloadedItemArray).map((i) => [i[mainItemId], i])
        ),
        subitems: new Map(
            (await preloadedSubitemsArray).map((i) => [i[subitemId], i])
        ),
        itemsSubitems,
        itemsWithExistentSubitems,
        organizations: new Map(
            (await preloadedOrganizationArray).map((i) => [
                i.organization_id,
                i,
            ])
        ),
    }
}

export interface RemoveProgramsFromSchoolsEntityMap extends EntityMap<School> {
    mainEntity: Map<string, School>
    organizations: Map<string, Organization>
    subitems: Map<string, Program>
    itemsSubitems: Map<string, Program>
    itemsWithExistentSubitems: Map<string, Program[]>
}

export class RemoveProgramsFromSchools extends AddMutation<
    School,
    RemoveProgramsFromSchoolInput,
    SchoolsMutationResult
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

    protected async authorize(
        _input: RemoveProgramsFromSchoolInput[],
        maps: RemoveProgramsFromSchoolsEntityMap
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
        inputs: RemoveProgramsFromSchoolInput[],
        entityMaps: RemoveProgramsFromSchoolsEntityMap
    ): {
        validInputs: { index: number; input: RemoveProgramsFromSchoolInput }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.schoolId),
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: RemoveProgramsFromSchoolInput,
        maps: RemoveProgramsFromSchoolsEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId, programIds } = currentInput

        for (const subitemId of programIds) {
            const subitem = maps.subitems.get(subitemId)
            if (!subitem) {
                errors.push(
                    createEntityAPIError(
                        'nonExistent',
                        index,
                        'Program',
                        subitemId
                    )
                )
                continue
            }

            const itemHasSubitem = maps.itemsSubitems.has(
                getMembershipMapKey(schoolId, subitemId)
            )

            if (!itemHasSubitem) {
                errors.push(
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'Program',
                        subitem.name,
                        'School',
                        currentEntity.school_name
                    )
                )
            }
        }
        return errors
    }

    protected process(
        currentInput: RemoveProgramsFromSchoolInput,
        maps: RemoveProgramsFromSchoolsEntityMap,
        index: number
    ) {
        const { schoolId, programIds } = currentInput

        const preExistentSubitems = maps.itemsWithExistentSubitems.get(
            schoolId
        )!
        const newSubitems = preExistentSubitems.filter(
            (subitem) => programIds.includes(subitem.id)!
        )

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        currentEntity.programs = Promise.resolve(newSubitems)
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

async function generateMapsForAddingRemovingPrograms(
    itemIds: string[],
    input: RemoveProgramsFromSchoolInput[]
): Promise<RemoveProgramsFromSchoolsEntityMap> {
    const relations = 'programs'
    const addingIds = 'programIds'
    const mainEntityName = 'School'
    const mainItemId = 'school_id'
    const subitemId = 'id'

    const preloadedItemArray = School.findByIds(itemIds, {
        where: { status: Status.ACTIVE },
        relations: [relations],
    })
    const preloadedSubitemsArray = Program.findByIds(
        input.map((val) => val[addingIds]).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const itemsWithExistentSubitems = new Map<string, Program[]>()
    const itemsSubitems = new Map<string, Program>()
    for (const item of await preloadedItemArray) {
        // eslint-disable-next-line no-await-in-loop
        const subitems = (await item.programs) || []
        itemsWithExistentSubitems.set(item[mainItemId], subitems)
        if (subitems.length > 0) {
            for (const subitem of subitems) {
                itemsSubitems.set(
                    getMembershipMapKey(item[mainItemId], subitem[subitemId]),
                    subitem
                )
            }
        }
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin(`Organization.schools`, mainEntityName)
        .where(`"${mainEntityName}"."${mainItemId}" IN (:...itemIds)`, {
            itemIds,
        })
        .getMany()

    return {
        mainEntity: new Map(
            (await preloadedItemArray).map((i) => [i[mainItemId], i])
        ),
        subitems: new Map(
            (await preloadedSubitemsArray).map((i) => [i[subitemId], i])
        ),
        itemsSubitems,
        itemsWithExistentSubitems,
        organizations: new Map(
            (await preloadedOrganizationArray).map((i) => [
                i.organization_id,
                i,
            ])
        ),
    }
}
