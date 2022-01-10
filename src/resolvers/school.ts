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
} from '../types/graphQL/school'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    AddMutation,
    UpdateMutation,
    RemoveMembershipMutation,
    AddMembershipMutation,
} from '../utils/mutations/commonStructure'
import { Class } from '../entities/class'
import {
    createEntityAPIError,
    createDuplicateInputAPIError,
    createNonExistentOrInactiveEntityAPIError,
    getMembershipMapKey,
} from '../utils/resolvers'
import { formatShortCode, generateShortCode } from '../utils/shortcode'
import { config } from '../config/config'
import { Program } from '../entities/program'
import { map } from 'lodash'
import { Role } from '../entities/role'

export class CreateSchools extends CreateMutation<
    School,
    CreateSchoolInput,
    SchoolsMutationResult
> {
    protected readonly EntityType = School
    protected inputTypeName = 'CreateSchoolInput'
    protected mainEntityIds: string[] = []
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
        for (const val of input) {
            this.mainEntityIds.push([val.organizationId, val.name].toString())
        }
    }

    generateEntityMaps = (
        input: CreateSchoolInput[]
    ): Promise<EntityMap<School>> => generateMapsForCreate(input, this.orgIds)

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.orgIds },
            PermissionName.create_school_20220
        )
    }

    protected validate(
        index: number,
        _entity: School,
        currentInput: CreateSchoolInput,
        maps: EntityMap<School>
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
                    'duplicateChild',
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
                    'duplicateChild',
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
        _entity: School,
        currentInput: CreateSchoolInput,
        maps: EntityMap<School>
    ): School[] {
        const { organizationId, name, shortCode } = currentInput

        const school = new School()
        school.school_name = name
        school.shortcode = shortCode
            ? formatShortCode(shortCode)
            : generateShortCode(name)
        school.organization = Promise.resolve(
            maps.organizations.get(organizationId) as Organization
        )

        return [school]
    }

    protected async buildOutput(): Promise<void> {
        this.output.schools = []
        for (const proccesedEntity of this.processedEntities) {
            // eslint-disable-next-line no-await-in-loop
            const schoolConnectionNode = await mapSchoolToSchoolConnectionNode(
                proccesedEntity
            )
            this.output.schools.push(schoolConnectionNode)
        }
    }
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
    ): Promise<EntityMap<School>> {
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
        entityMaps: EntityMap<School>
    ) {
        const organizationIds: string[] = []
        for (const c of entityMaps.mainEntity.values()) {
            const organizationId = (await c.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_school_20330
        )
    }

    protected validate(
        index: number,
        currentEntity: School,
        currentInput: UpdateSchoolInput,
        maps: EntityMap<School>
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
            (matchingOrgAndName as School).school_id !== currentEntity.school_id
        ) {
            errors.push(
                createEntityAPIError(
                    'duplicateChild',
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
            (matchingOrgAndShortcode as School).school_id !==
                currentEntity.school_id
        ) {
            errors.push(
                createEntityAPIError(
                    'duplicateChild',
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
        currentEntity: School,
        currentInput: UpdateSchoolInput
    ): School[] {
        const { name, shortCode } = currentInput
        currentEntity.school_name = name
        currentEntity.shortcode =
            formatShortCode(
                shortCode,
                config.limits.SCHOOL_SHORTCODE_MAX_LENGTH
            ) || currentEntity.shortcode
        return [currentEntity]
    }

    protected async buildOutput(): Promise<void> {
        this.output.schools = []
        for (const proccesedEntity of this.processedEntities) {
            this.output.schools.push(
                await mapSchoolToSchoolConnectionNode(proccesedEntity)
            )
        }
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

    protected async generateEntityMaps(): Promise<EntityMap<School>> {
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
        entityMaps: EntityMap<School>
    ) {
        const organizationIds: string[] = []
        for (const c of entityMaps.mainEntity.values()) {
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

export class AddUsersToSchools extends AddMembershipMutation<
    School,
    AddUsersToSchoolInput,
    SchoolsMutationResult,
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

    protected async generateEntityMaps(
        input: AddUsersToSchoolInput[]
    ): Promise<EntityMap<School>> {
        const schoolsPromise = School.findByIds(this.mainEntityIds, {
            where: { status: Status.ACTIVE },
        })
        const usersPromise = User.findByIds(
            input.map((i) => i.userIds).flat(),
            { where: { status: Status.ACTIVE } }
        )
        const membershipsPromise = SchoolMembership.find({
            where: {
                user_id: In(input.map((i) => i.userIds).flat()),
                school_id: In(this.mainEntityIds),
                status: Status.ACTIVE,
            },
        })
        const organizationsPromise = Organization.find({
            join: {
                alias: 'Organization',
                innerJoin: {
                    schools: 'Organization.schools',
                },
            },
            where: (qb: WhereExpression) => {
                qb.where('schools.school_id IN (:...schoolIds)', {
                    schoolIds: this.mainEntityIds,
                })
            },
        })

        const rolesPromise = Role.findByIds(
            input.map((i) => i.schoolRoleIds).flat(),
            {
                where: {
                    status: Status.ACTIVE,
                },
            }
        )

        return {
            mainEntity: new Map(
                (await schoolsPromise).map((s) => [s.school_id, s])
            ),
            users: new Map((await usersPromise).map((u) => [u.user_id, u])),
            organizations: new Map(
                (await organizationsPromise).map((o) => [o.organization_id, o])
            ),
            memberships: new Map(
                (await membershipsPromise).map((i) => [
                    getMembershipMapKey(i.school_id, i.user_id),
                    i,
                ])
            ),
            roles: new Map((await rolesPromise).map((i) => [i.role_id, i])),
        }
    }

    protected async authorize(
        _input: AddUsersToSchoolInput[],
        maps: EntityMap<School>
    ) {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validate(
        index: number,
        currentEntity: School,
        currentInput: AddUsersToSchoolInput,
        maps: EntityMap<School>
    ): APIError[] {
        const errors: APIError[] = []

        // role validation
        const missingRoleIds: string[] = currentInput.schoolRoleIds.reduce(
            (acc: string[], schoolRoleId: string) => {
                if (!maps.roles.has(schoolRoleId)) acc.push(schoolRoleId)
                return acc
            },
            []
        )
        if (missingRoleIds.length) {
            errors.push(
                createEntityAPIError(
                    'nonExistent',
                    index,
                    'Role',
                    missingRoleIds.toString()
                )
            )
        }

        for (const userId of currentInput.userIds) {
            // user validation
            const user = maps.users.get(userId) as User
            if (!user) {
                errors.push(
                    createEntityAPIError('nonExistent', index, 'User', userId)
                )
                continue
            }
            // membership validation
            if (
                maps.memberships.has(
                    getMembershipMapKey(currentInput.schoolId, userId)
                )
            ) {
                errors.push(
                    createEntityAPIError(
                        'duplicateChild',
                        index,
                        'User',
                        user.user_name(),
                        'School',
                        currentEntity.school_name,
                        ['school_id', 'user_id']
                    )
                )
            }
        }

        return errors
    }

    protected process(
        currentEntity: School,
        currentInput: AddUsersToSchoolInput,
        maps: EntityMap<School>
    ): SchoolMembership[] {
        const memberships: SchoolMembership[] = []

        for (const userId of currentInput.userIds) {
            const membership = new SchoolMembership()
            membership.school_id = currentEntity.school_id
            membership.school = Promise.resolve(currentEntity)
            membership.user_id = userId
            membership.user = Promise.resolve(maps.users.get(userId) as User)
            membership.roles = Promise.resolve(
                currentInput.schoolRoleIds.map((r) => maps.roles.get(r) as Role)
            )
            memberships.push(membership)
        }

        return memberships
    }

    protected async buildOutput(currentEntity: School): Promise<void> {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
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
    ): Promise<EntityMap<School>> =>
        generateMapsForRemoveUsers(this.mainEntityIds, input)

    protected async authorize(
        _input: RemoveUsersFromSchoolInput[],
        maps: EntityMap<School>
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validate(
        index: number,
        currentEntity: School,
        currentInput: RemoveUsersFromSchoolInput,
        maps: EntityMap<School>
    ): APIError[] {
        // Retrieval
        const errors: APIError[] = []
        const { schoolId, userIds } = currentInput

        const uniqueUserIds = new Set(userIds)

        if (uniqueUserIds.size < userIds.length) {
            errors.push(
                createDuplicateInputAPIError(
                    index,
                    ['userIds'],
                    'RemoveUsersFromSchoolInput'
                )
            )
        }

        for (const userId of userIds) {
            // User validation
            const user = maps.users.get(userId) as User

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
        _currentEntity: School,
        currentInput: RemoveUsersFromSchoolInput,
        maps: EntityMap<School>
    ): SchoolMembership[] {
        const { schoolId, userIds } = currentInput
        const memberships: SchoolMembership[] = []

        for (const userId of userIds) {
            const membership = maps.memberships.get(
                [schoolId, userId].toString()
            ) as SchoolMembership

            Object.assign(membership, this.partialEntity)
            memberships.push(membership)
        }

        return memberships
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
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
    ): Promise<EntityMap<School>> =>
        generateMapsForAddingClasses(this.mainEntityIds, input)

    protected async authorize(
        _input: AddClassesToSchoolInput[],
        maps: EntityMap<School>
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: AddClassesToSchoolInput,
        maps: EntityMap<School>
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId: itemId, classIds: subitemIds } = currentInput
        const mainEntityName = 'School'
        const subEntityName = 'Class'
        const mainEntityKeyName = 'school_name'
        const subEntityKeyName = 'class_name'

        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId) as Class
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
                        'duplicateChild',
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

    protected process = (
        currentEntity: School,
        currentInput: AddClassesToSchoolInput,
        maps: EntityMap<School>
    ): School[] => {
        const { schoolId: itemId, classIds: subitemIds } = currentInput

        const newSubitems: Class[] = []
        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId) as Class
            newSubitems.push(subitem)
        }
        const preexistentSubitems = maps.itemsWithExistentSubitems.get(itemId)
        currentEntity.classes = Promise.resolve([
            ...(preexistentSubitems as Class[]),
            ...newSubitems,
        ])
        return [currentEntity]
    }

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
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

    generateEntityMaps = async (
        input: AddProgramsToSchoolInput[]
    ): Promise<EntityMap<School>> => {
        const itemIds = this.mainEntityIds
        const relations = 'programs'
        const addingIds = 'programIds'
        const mainEntityName = 'School'
        const mainitemId = 'school_id'
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
            itemsWithExistentSubitems.set(item[mainitemId], subitems)
            if (subitems.length > 0) {
                for (const subitem of subitems) {
                    itemsSubitems.set(
                        getMembershipMapKey(
                            item[mainitemId],
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
            .where(`"${mainEntityName}"."${mainitemId}" IN (:...itemIds)`, {
                itemIds,
            })
            .getMany()

        return {
            mainEntity: new Map(
                (await preloadedItemArray).map((i) => [i[mainitemId], i])
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
        maps: EntityMap<School>
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: AddProgramsToSchoolInput,
        maps: EntityMap<School>
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId: itemId, programIds: subitemIds } = currentInput
        const mainEntityName = 'School'
        const subEntityName = 'Program'
        const mainEntityKeyName = 'school_name'
        const subEntityKeyName = 'name'

        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId) as Program
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
                        'duplicateChild',
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

    protected process = (
        currentEntity: School,
        currentInput: AddProgramsToSchoolInput,
        maps: EntityMap<School>
    ): School[] => {
        const { schoolId: itemId, programIds: subitemIds } = currentInput

        const newSubitems: Program[] = []
        for (const subitemId of subitemIds) {
            const subitem = maps.subitems.get(subitemId) as Program
            newSubitems.push(subitem)
        }
        const preexistentSubitems = maps.itemsWithExistentSubitems.get(itemId)
        currentEntity.programs = Promise.resolve([
            ...(preexistentSubitems as Program[]),
            ...newSubitems,
        ])
        return [currentEntity]
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
): Promise<EntityMap<School>> {
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
): Promise<EntityMap<School>> {
    const relations = 'classes'
    const addingIds = 'classIds'
    const mainEntityName = 'School'
    const mainitemId = 'school_id'
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
        itemsWithExistentSubitems.set(item[mainitemId], subitems)
        if (subitems.length > 0) {
            for (const subitem of subitems) {
                itemsSubitems.set(
                    getMembershipMapKey(item[mainitemId], subitem[subitemId]),
                    subitem
                )
            }
        }
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin(`Organization.schools`, mainEntityName)
        .where(`"${mainEntityName}"."${mainitemId}" IN (:...itemIds)`, {
            itemIds,
        })
        .getMany()

    return {
        mainEntity: new Map(
            (await preloadedItemArray).map((i) => [i[mainitemId], i])
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
    ): Promise<EntityMap<School>> =>
        generateMapsForAddingRemovingPrograms(this.mainEntityIds, input)

    protected async authorize(
        _input: RemoveProgramsFromSchoolInput[],
        maps: EntityMap<School>
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validate = (
        index: number,
        currentEntity: School,
        currentInput: RemoveProgramsFromSchoolInput,
        maps: EntityMap<School>
    ): APIError[] => {
        const errors: APIError[] = []
        const { schoolId, programIds } = currentInput

        for (const subitemId of programIds) {
            const subitem = maps.subitems.get(subitemId) as Program
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

    protected process = (
        currentEntity: School,
        currentInput: RemoveProgramsFromSchoolInput,
        maps: EntityMap<School>
    ): School[] => {
        const { schoolId, programIds } = currentInput

        const preexistentSubitems = maps.itemsWithExistentSubitems.get(
            schoolId
        ) as Program[]
        const newSubitems = preexistentSubitems.filter((subitem) =>
            programIds.includes(subitem.id)
        )
        currentEntity.programs = Promise.resolve(newSubitems)
        return [currentEntity]
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
): Promise<EntityMap<School>> {
    const relations = 'programs'
    const addingIds = 'programIds'
    const mainEntityName = 'School'
    const mainitemId = 'school_id'
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
        itemsWithExistentSubitems.set(item[mainitemId], subitems)
        if (subitems.length > 0) {
            for (const subitem of subitems) {
                itemsSubitems.set(
                    getMembershipMapKey(item[mainitemId], subitem[subitemId]),
                    subitem
                )
            }
        }
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin(`Organization.schools`, mainEntityName)
        .where(`"${mainEntityName}"."${mainitemId}" IN (:...itemIds)`, {
            itemIds,
        })
        .getMany()

    return {
        mainEntity: new Map(
            (await preloadedItemArray).map((i) => [i[mainitemId], i])
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
