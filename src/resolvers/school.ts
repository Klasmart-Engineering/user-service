import { In } from 'typeorm'
import { Organization } from '../entities/organization'
import { School } from '../entities/school'
import { Status } from '../entities/status'
import { Context } from '../main'
import {
    schoolConnectionNodeFields,
    mapSchoolToSchoolConnectionNode,
} from '../pagination/schoolsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateSchoolInput,
    DeleteSchoolInput,
    SchoolsMutationResult,
    AddClassesToSchoolInput,
} from '../types/graphQL/school'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    AddMutation,
} from '../utils/mutations/commonStructure'
import { Class } from '../entities/class'
import {
    createEntityAPIError,
    getMembershipMapKey,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers'
import { formatShortCode, generateShortCode } from '../utils/shortcode'

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
        context: Pick<Context, 'permissions'>
    ) {
        super(input, context)
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
        await this.context.permissions.rejectIfNotAllowed(
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
        context: Pick<Context, 'permissions'>
    ) {
        super(input, context)
        this.mainEntityIds = input.map((val) => val.schoolId)
    }

    generateEntityMaps = async (
        input: AddClassesToSchoolInput[]
    ): Promise<EntityMap<School>> => generateMaps(this.mainEntityIds, input)

    protected async authorize(
        _input: AddClassesToSchoolInput[],
        maps: EntityMap<School>
    ): Promise<void> {
        return this.context.permissions.rejectIfNotAllowed(
            {
                organization_ids: [...maps.organizations.keys()],
                school_ids: this.mainEntityIds,
            },
            PermissionName.edit_school_20330
        )
    }

    protected validate = validateForAddRemove

    protected process = processForAdd

    protected buildOutput = async (currentEntity: School): Promise<void> => {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}

async function generateMaps(
    schoolIds: string[],
    input: AddClassesToSchoolInput[]
): Promise<EntityMap<School>> {
    const preloadedSchoolArray = School.findByIds(schoolIds, {
        where: { status: Status.ACTIVE },
        relations: ['classes'],
    })
    const preloadedClassesArray = Class.findByIds(
        input.map((val) => val.classIds).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const schoolsWithExistentClasses = new Map<string, Class[]>()
    const schoolClasses = new Map<string, Class>()
    for (const school of await preloadedSchoolArray) {
        // eslint-disable-next-line no-await-in-loop
        const classes = (await school.classes) || []
        schoolsWithExistentClasses.set(school.school_id, classes)
        if (classes.length > 0) {
            for (const cls of classes) {
                schoolClasses.set(
                    getMembershipMapKey(school.school_id, cls.class_id),
                    cls
                )
            }
        }
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin('Organization.schools', 'School')
        .where('School.school_id IN (:...schoolIds)', { schoolIds })
        .getMany()

    return {
        mainEntity: new Map(
            (await preloadedSchoolArray).map((i) => [i.school_id, i])
        ),
        classes: new Map(
            (await preloadedClassesArray).map((i) => [i.class_id, i])
        ),
        schoolClasses,
        schoolsWithExistentClasses,
        organizations: new Map(
            (await preloadedOrganizationArray).map((i) => [
                i.organization_id,
                i,
            ])
        ),
    }
}

function validateForAddRemove(
    this: AddClassesToSchools,
    index: number,
    currentEntity: School,
    currentInput: AddClassesToSchoolInput,
    maps: EntityMap<School>
): APIError[] {
    const errors: APIError[] = []
    const { schoolId, classIds } = currentInput

    for (const classId of classIds) {
        const cls = maps.classes.get(classId) as Class
        if (!cls) {
            errors.push(
                createEntityAPIError('nonExistent', index, 'Class', classId)
            )
        }
        if (!cls) continue

        const mutationType = this.inputTypeName.startsWith('Add')
            ? 'Add'
            : 'Remove'
        const schoolHasClass = maps.schoolClasses.has(
            getMembershipMapKey(schoolId, classId)
        )
        if (mutationType === 'Add' && schoolHasClass) {
            errors.push(
                createEntityAPIError(
                    'duplicateChild',
                    index,
                    'Class',
                    cls.class_name,
                    'School',
                    currentEntity.school_name
                )
            )
        }
        if (mutationType === 'Remove' && !schoolHasClass) {
            errors.push(
                createEntityAPIError(
                    'nonExistentChild',
                    index,
                    'Class',
                    cls.class_name,
                    'School',
                    currentEntity.school_name
                )
            )
        }
    }
    return errors
}

function processForAdd(
    currentEntity: School,
    currentInput: AddClassesToSchoolInput,
    maps: EntityMap<School>
): School[] {
    const { schoolId, classIds } = currentInput

    const newClasses: Class[] = []
    for (const classId of classIds) {
        const cls = maps.classes.get(classId) as Class
        newClasses.push(cls)
    }
    const preexistentClasses = maps.schoolsWithExistentClasses.get(schoolId)
    currentEntity.classes = Promise.resolve([
        ...(preexistentClasses as Class[]),
        ...newClasses,
    ])
    return [currentEntity]
}

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
        context: Pick<Context, 'permissions'>
    ) {
        super(input, context)
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
        return this.context.permissions.rejectIfNotAllowed(
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
