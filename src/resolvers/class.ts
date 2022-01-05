import { getManager, In } from 'typeorm'
import { Context } from '../main'
import {
    DeleteClassInput,
    ClassesMutationResult,
    ClassConnectionNode,
    AddProgramsToClassInput,
} from '../types/graphQL/class'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { Status } from '../entities/status'
import { Class } from '../entities/class'
import { PermissionName } from '../permissions/permissionNames'
import {
    createDuplicateInputAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    getMembershipMapKey,
} from '../utils/resolvers'
import { mapClassToClassConnectionNode } from '../pagination/classesConnection'
import { config } from '../config/config'
import { Program } from '../entities/program'
import { AddMutation, EntityMap } from '../utils/mutations/commonStructure'
import { Organization } from '../entities/organization'

export async function deleteClasses(
    args: { input: DeleteClassInput[] },
    context: Pick<Context, 'permissions'>
): Promise<ClassesMutationResult> {
    // Input length validations
    if (args.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('User', 'min')
    }
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('User', 'max')
    }

    // Preload Data
    const classIds = args.input.map((val) => val.id)
    const preloadedData = await Class.createQueryBuilder('Class')
        .select(['Class.class_id', 'ClassOrganization.organization_id'])
        .leftJoin('Class.organization', 'ClassOrganization')
        .where('Class.class_id IN (:...classIds)', { classIds })
        .andWhere('Class.status = :status', { status: Status.ACTIVE })
        .getMany()
    const preloadedClasses = new Map(preloadedData.map((c) => [c.class_id, c]))

    // Check Permissions
    const orgIdSet = new Set<string>()
    for (const c of preloadedClasses.values()) {
        const org = await c.organization
        if (org) orgIdSet.add(org.organization_id)
    }
    await context.permissions.rejectIfNotAllowed(
        { organization_ids: [...orgIdSet] },
        PermissionName.delete_class_20444
    )

    // Process Inputs
    const errors: APIError[] = []
    const output: ClassConnectionNode[] = []
    const partialClass = {
        status: Status.INACTIVE,
        deleted_at: new Date(),
    }
    for (const [index, classId] of classIds.entries()) {
        const dbClass = preloadedClasses.get(classId)

        // Validations
        const inputIdIsDuplicate = classIds.some(
            (item, findIndex) => item === classId && findIndex < index
        )
        if (inputIdIsDuplicate) {
            errors.push(
                createDuplicateInputAPIError(index, ['id'], 'DeleteClassInput')
            )
            continue
        }
        if (!dbClass) {
            errors.push(
                createEntityAPIError('inactive', index, 'Class', classId)
            )
            continue
        }

        // Build output
        Object.assign(dbClass, partialClass)
        output.push(mapClassToClassConnectionNode(dbClass))
    }

    if (errors.length > 0) throw new APIErrorCollection(errors)
    try {
        await getManager()
            .createQueryBuilder()
            .update(Class)
            .set(partialClass)
            .where({ class_id: In(classIds) })
            .execute()
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Class',
        })
    }

    return { classes: output }
}

export class AddProgramsToClasses extends AddMutation<
    Class,
    AddProgramsToClassInput,
    ClassesMutationResult
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'AddProgramsToClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: AddProgramsToClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: AddProgramsToClassInput[]
    ): Promise<EntityMap<Class>> => generateMaps(this.mainEntityIds, input)

    protected async authorize(
        _input: AddProgramsToClassInput[],
        maps: EntityMap<Class>
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: [...maps.organizations.keys()] },
            PermissionName.edit_class_20334
        )
    }

    protected validate = (
        index: number,
        currentEntity: Class,
        currentInput: AddProgramsToClassInput,
        maps: EntityMap<Class>
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, programIds } = currentInput

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
            }
            if (!subitem) continue

            const itemHasSubitem = maps.itemsSubitems.has(
                getMembershipMapKey(classId, subitemId)
            )

            if (itemHasSubitem) {
                errors.push(
                    createEntityAPIError(
                        'duplicateChild',
                        index,
                        'Program',
                        subitem.name,
                        'Class',
                        currentEntity.class_name
                    )
                )
            }
        }
        return errors
    }

    protected process = (
        currentEntity: Class,
        currentInput: AddProgramsToClassInput,
        maps: EntityMap<Class>
    ): Class[] => {
        const { classId, programIds } = currentInput

        const newSubitems: Program[] = []
        for (const subitemId of programIds) {
            const subitem = maps.subitems.get(subitemId) as Program
            newSubitems.push(subitem)
        }
        const preexistentSubitems = maps.itemsWithExistentSubitems.get(classId)
        currentEntity.programs = Promise.resolve([
            ...(preexistentSubitems as Program[]),
            ...newSubitems,
        ])
        return [currentEntity]
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

async function generateMaps(
    itemIds: string[],
    input: AddProgramsToClassInput[]
): Promise<EntityMap<Class>> {
    const relations = 'programs'
    const addingIds = 'programIds'
    const mainEntityName = 'Class'
    const mainitemId = 'class_id'
    const subitemId = 'id'

    const preloadedItemArray = Class.findByIds(itemIds, {
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
        .innerJoin(`Organization.classes`, mainEntityName)
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
