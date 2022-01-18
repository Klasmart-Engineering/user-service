import { Brackets, getConnection, getManager, In } from 'typeorm'
import { Context } from '../main'
import {
    DeleteClassInput,
    ClassesMutationResult,
    ClassConnectionNode,
    AddProgramsToClassInput,
    RemoveProgramsFromClassInput,
    CreateClassInput,
} from '../types/graphQL/class'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { Status } from '../entities/status'
import { Class } from '../entities/class'
import { PermissionName } from '../permissions/permissionNames'
import {
    createDuplicateAttributeAPIError,
    createDuplicateChildEntityAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers/errors'
import { mapClassToClassConnectionNode } from '../pagination/classesConnection'
import { config } from '../config/config'
import { Program } from '../entities/program'
import {
    AddMutation,
    EntityMap,
    validateActiveAndNoDuplicates,
    CreateMutation,
    validateNoDuplicate,
    RemoveMutation,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { Organization } from '../entities/organization'
import {
    generateShortCode,
    validateShortCode,
    newValidateShortCode,
} from '../utils/shortcode'
import clean from '../utils/clean'
import { ObjMap } from '../utils/stringUtils'
import { getMap } from '../utils/resolvers/entityMaps'
import {
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
} from '../utils/resolvers/inputValidation'

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
        // eslint-disable-next-line no-await-in-loop
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
                createDuplicateAttributeAPIError(
                    index,
                    ['id'],
                    'DeleteClassInput'
                )
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

export interface EntityMapAddRemovePrograms extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    programs: Map<string, Program>
    classPrograms: Map<string, Program[]>
    organizations: Map<string, Organization>
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
    ): Promise<EntityMap<Class>> =>
        generateMapsForAddingRemovingPrograms(this.mainEntityIds, input)

    protected async authorize(
        _input: AddProgramsToClassInput[],
        maps: EntityMapAddRemovePrograms
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: [...maps.organizations.keys()] },
            PermissionName.edit_class_20334
        )
    }

    protected validationOverAllInputs(
        inputs: AddProgramsToClassInput[],
        entityMaps: EntityMapAddRemovePrograms
    ): {
        validInputs: { index: number; input: AddProgramsToClassInput }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.classId),
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate = (
        index: number,
        _currentClass: Class,
        currentInput: AddProgramsToClassInput,
        maps: EntityMapAddRemovePrograms
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, programIds } = currentInput
        const programMap = maps.programs

        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...programs.errors)

        if (programs.errors.length) return errors
        const classProgramIds = new Set(
            maps.classPrograms.get(classId)?.map((p) => p.id)
        )
        const programChildErrors = flagExistentChild(
            Class,
            Program,
            index,
            classId,
            programIds,
            classProgramIds
        )
        if (programChildErrors.length) errors.push(...programChildErrors)

        return errors
    }

    protected process(
        currentInput: AddProgramsToClassInput,
        maps: EntityMapAddRemovePrograms,
        index: number
    ) {
        const { classId, programIds } = currentInput

        const currentClass = maps.mainEntity.get(this.mainEntityIds[index])!

        const newPrograms: Program[] = []
        for (const programId of programIds) {
            const program = maps.programs.get(programId) as Program
            newPrograms.push(program)
        }

        const preExistentPrograms = maps.classPrograms.get(classId)!

        currentClass.programs = Promise.resolve([
            ...preExistentPrograms,
            ...newPrograms,
        ])

        return { outputEntity: currentClass }
    }

    protected buildOutput = async (currentClass: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentClass))
    }
}

export class RemoveProgramsFromClasses extends RemoveMutation<
    Class,
    RemoveProgramsFromClassInput,
    ClassesMutationResult
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'RemoveProgramsFromClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: RemoveProgramsFromClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: RemoveProgramsFromClassInput[]
    ): Promise<EntityMapAddRemovePrograms> =>
        generateMapsForAddingRemovingPrograms(this.mainEntityIds, input)

    protected async authorize(
        _input: RemoveProgramsFromClassInput[],
        maps: EntityMapAddRemovePrograms
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: [...maps.organizations.keys()] },
            PermissionName.edit_class_20334
        )
    }

    protected validationOverAllInputs(
        inputs: RemoveProgramsFromClassInput[],
        entityMaps: EntityMapAddRemovePrograms
    ): {
        validInputs: { index: number; input: RemoveProgramsFromClassInput }[]
        apiErrors: APIError[]
    } {
        const validateSubItems = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'programIds'
        )

        const validateActAndNoDup = validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((val) => val.classId),
            this.EntityType.name,
            this.inputTypeName
        )

        const validInputs = Array.from(
            new Map(
                [
                    ...validateActAndNoDup.validInputs,
                    ...validateSubItems.validInputs,
                ].map((i) => [i.index, i])
            ).values()
        )

        return {
            validInputs,
            apiErrors: [
                ...validateSubItems.apiErrors,
                ...validateActAndNoDup.apiErrors,
            ],
        }
    }

    protected validate = (
        index: number,
        _currentClass: Class,
        currentInput: RemoveProgramsFromClassInput,
        maps: EntityMapAddRemovePrograms
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, programIds } = currentInput
        const programMap = maps.programs

        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...programs.errors)

        if (programs.errors.length) return errors
        const classProgramIds = new Set(
            maps.classPrograms.get(classId)?.map((p) => p.id)
        )
        const programChildErrors = flagNonExistentChild(
            Class,
            Program,
            index,
            classId,
            programIds,
            classProgramIds
        )
        if (programChildErrors.length) errors.push(...programChildErrors)

        return errors
    }

    protected process(
        currentInput: RemoveProgramsFromClassInput,
        maps: EntityMapAddRemovePrograms,
        index: number
    ) {
        const { classId, programIds } = currentInput
        const programIdsSet = new Set(programIds)
        const preExistentPrograms = maps.classPrograms.get(classId)!
        const keptPrograms = preExistentPrograms.filter(
            (program) => !programIdsSet.has(program.id)
        )

        const currentClass = maps.mainEntity.get(this.mainEntityIds[index])!
        currentClass.programs = Promise.resolve(keptPrograms)

        return { outputEntity: currentClass }
    }

    protected buildOutput = async (currentClass: Class): Promise<void> => {
        this.output.classes.push(
            await mapClassToClassConnectionNode(currentClass)
        )
    }
}

async function generateMapsForAddingRemovingPrograms(
    classIds: string[],
    input: AddProgramsToClassInput[]
): Promise<EntityMapAddRemovePrograms> {
    const classes = getMap.class(classIds, ['programs'])
    const allProgramIds = input.map((val) => val.programIds).flat()
    const programs = getMap.program(allProgramIds)
    const classPrograms = new Map<string, Program[]>()

    for (const class_ of (await classes).values()) {
        // eslint-disable-next-line no-await-in-loop
        classPrograms.set(class_.class_id, (await class_.programs) || [])
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin(`Organization.classes`, 'Class')
        .where(`"Class"."class_id" IN (:...classIds)`, {
            classIds,
        })
        .getMany()

    return {
        mainEntity: await classes,
        programs: await programs,
        classPrograms,
        organizations: new Map(
            (await preloadedOrganizationArray).map((i) => [
                i.organization_id,
                i,
            ])
        ),
    }
}
export interface EntityMapCreateClass extends EntityMap<Class> {
    organizations: Map<string, Organization>
    conflictingNames: ObjMap<
        {
            name: string
            organizationId: string
        },
        string
    >
    conflictingShortcodes: ObjMap<
        {
            shortcode: string
            organizationId: string
        },
        string
    >
}

export class CreateClasses extends CreateMutation<
    Class,
    CreateClassInput,
    ClassesMutationResult
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'CreateClassInput'
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: CreateClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
    }

    normalize(input: CreateClassInput[]) {
        for (const inputElement of input) {
            if (inputElement.shortcode === undefined) {
                inputElement.shortcode = generateShortCode()
            } else {
                inputElement.shortcode = clean.shortcode(inputElement.shortcode)
            }
        }
        return input
    }

    // this will over fetch more then the strictly needed
    // shortcode/orgId and name/orgId combinations
    // that's done so we can use `IN` operators instead of
    // an OR per input element
    async generateEntityMaps(
        input: CreateClassInput[]
    ): Promise<EntityMapCreateClass> {
        const orgs = input.map(({ organizationId }) => organizationId)

        const preloadedOrgArray = getMap.organization(orgs)
        const names = input.map(({ name }) => name)
        const validShortcodes = input
            .map(({ shortcode }) => shortcode)
            .filter((shortcode) => validateShortCode(shortcode))
        const conflictingClasses: Promise<
            {
                name: string
                shortcode: string
                organization_id: string
                class_id: string
            }[]
        > = getConnection()
            .createQueryBuilder()
            .select(
                `class.class_name AS name,
                class.shortcode AS shortcode,
                class."organizationOrganizationId" AS organization_id,
                class.class_id`
            )
            .from('class', 'class')
            .where(
                new Brackets((qb) => {
                    qb.where({
                        class_name: In(names),
                    }).orWhere(
                        new Brackets((qb2) => {
                            qb2.where({
                                shortcode: In(validShortcodes),
                            })
                        })
                    )
                })
            )
            // we can't use the typeORM `In()` function because
            // `organizationOrganizationId` is not a property of the class entity
            // don't filter out inactive orgs, as we have a db constraint on
            // (organization_id, class_name)
            .andWhere('class.organizationOrganizationId IN (:...orgs)', {
                orgs,
            })
            .getRawMany()

        return {
            organizations: new Map(
                [...(await preloadedOrgArray).values()].map((org) => [
                    org.organization_id,
                    org,
                ])
            ),
            conflictingNames: new ObjMap(
                (await conflictingClasses)!.map(
                    ({ name, organization_id, class_id }) => {
                        return {
                            key: {
                                name,
                                organizationId: organization_id,
                            },
                            value: class_id,
                        }
                    }
                )
            ),
            conflictingShortcodes: new ObjMap(
                (await conflictingClasses)!.map(
                    ({ shortcode, organization_id, class_id }) => {
                        return {
                            key: {
                                shortcode,
                                organizationId: organization_id,
                            },
                            value: class_id,
                        }
                    }
                )
            ),
        }
    }

    authorize(input: CreateClassInput[]): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: input.map((i) => i.organizationId) },
            PermissionName.create_class_20224
        )
    }

    validationOverAllInputs(inputs: CreateClassInput[]) {
        const errors: APIError[] = []

        const failedDuplicateNames = validateNoDuplicate(
            inputs.map((i) => i.name),
            'class',
            'name'
        )

        errors.push(...failedDuplicateNames.values())

        const failedDuplicateShortcodes = validateNoDuplicate(
            inputs.map((i) => i.shortcode!),
            'class',
            'shortcode'
        )

        errors.push(...failedDuplicateShortcodes.values())

        const validInputs = inputs
            .map((i, index) => {
                return { input: i, index }
            })
            .filter(
                (_, index) =>
                    !failedDuplicateNames.has(index) &&
                    !failedDuplicateShortcodes.has(index)
            )

        return { validInputs, apiErrors: errors }
    }

    validate(
        index: number,
        _currentClass: undefined,
        currentInput: CreateClassInput,
        maps: EntityMapCreateClass
    ): APIError[] {
        const errors: APIError[] = []
        const { name, shortcode, organizationId } = currentInput
        const org = maps.organizations.get(organizationId)
        if (!org) {
            errors.push(
                createNonExistentOrInactiveEntityAPIError(
                    index,
                    [],
                    'ID',
                    'Organization',
                    organizationId
                )
            )
        }

        const conflictingNameClassId = maps.conflictingNames.get({
            name,
            organizationId,
        })

        if (conflictingNameClassId !== undefined) {
            errors.push(
                createDuplicateChildEntityAttributeAPIError(
                    'Class',
                    conflictingNameClassId,
                    'Organization',
                    organizationId,
                    'name',
                    name,
                    0
                )
            )
        }

        const conflictingShortcodeClassId = maps.conflictingShortcodes.get({
            shortcode: shortcode!,
            organizationId,
        })

        if (conflictingShortcodeClassId) {
            errors.push(
                createDuplicateChildEntityAttributeAPIError(
                    'Class',
                    conflictingShortcodeClassId,
                    'Organization',
                    organizationId,
                    'shortcode',
                    shortcode!,
                    0
                )
            )
        }

        const shortCodeErrors = newValidateShortCode('Class', shortcode, index)

        errors.push(...shortCodeErrors)

        return errors
    }

    process(
        currentInput: CreateClassInput,
        maps: EntityMapCreateClass
    ): { outputEntity: Class } {
        const { organizationId, name, shortcode } = currentInput
        const outputEntity = new Class()
        outputEntity.class_name = name
        outputEntity.shortcode = shortcode
        outputEntity.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        return { outputEntity }
    }

    async buildOutput(outputEntity: Class): Promise<void> {
        this.output.classes.push(mapClassToClassConnectionNode(outputEntity))
    }
}
