import { School } from '../entities/school'
import { Context } from '../main'
import {
    schoolConnectionNodeFields,
    mapSchoolToSchoolConnectionNode,
} from '../pagination/schoolsConnection'
import { PermissionName } from '../permissions/permissionNames'
import {
    DeleteSchoolInput,
    SchoolsMutationResult,
    AddClassesToSchoolInput,
} from '../types/graphQL/school'
import {
    DeleteMutation,
    EntityMap,
    AddMutation,
} from '../utils/mutations/commonStructure'
import { Class } from '../entities/class'
import { Status } from '../entities/status'
import { APIError } from '../types/errors/apiError'
import { createEntityAPIError, getMembershipMapKey } from '../utils/resolvers'
import { Organization } from '../entities/organization'

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
