import { Brackets, getConnection, getManager, In } from 'typeorm'
import { Context } from '../main'
import {
    DeleteClassInput,
    ClassesMutationResult,
    ClassConnectionNode,
    AddProgramsToClassInput,
    RemoveProgramsFromClassInput,
    CreateClassInput,
    UpdateClassInput,
    AddStudentsToClassInput,
    RemoveStudentsFromClassInput,
    AddTeachersToClassInput,
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
    UpdateMutation,
    filterInvalidInputs,
    validateNoDuplicateAttribute,
} from '../utils/mutations/commonStructure'
import { Organization } from '../entities/organization'
import {
    generateShortCode,
    validateShortCode,
    newValidateShortCode,
} from '../utils/shortcode'
import clean from '../utils/clean'
import { ObjMap } from '../utils/stringUtils'
import {
    getMap,
    OrganizationMembershipMap,
} from '../utils/resolvers/entityMaps'
import {
    flagExistent,
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
} from '../utils/resolvers/inputValidation'
import logger from '../logging'
import { User } from '../entities/user'
import { OrganizationMembership } from '../entities/organizationMembership'

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
    ClassesMutationResult,
    EntityMapAddRemovePrograms
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

    generateEntityMaps = async (input: AddProgramsToClassInput[]) =>
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
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.classId),
                this.EntityType.name,
                this.inputTypeName
            )
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
    ClassesMutationResult,
    EntityMapAddRemovePrograms
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

        return filterInvalidInputs(inputs, [
            ...validateActAndNoDup,
            ...validateSubItems,
        ])
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
    const programs = getMap.program(input.flatMap((i) => i.programIds))

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
    ClassesMutationResult,
    EntityMapCreateClass
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

export interface UpdateClassEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    classOrgs: Map<string, Organization>
    existingOrgClassesWithMatchingNames: ObjMap<
        { className: string; orgId: string },
        Class
    >
    existingOrgClassesWithMatchingShortcodes: ObjMap<
        { classShortcode: string; orgId: string },
        Class
    >
}

export class UpdateClasses extends UpdateMutation<
    Class,
    UpdateClassInput,
    ClassesMutationResult,
    UpdateClassEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'UpdateClassInput'
    protected readonly mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: UpdateClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    normalize(inputs: UpdateClassInput[]) {
        for (const input of inputs) {
            if (input.shortcode) {
                input.shortcode = clean.shortcode(input.shortcode)
            }
        }
        return inputs
    }

    async generateEntityMaps(
        inputs: UpdateClassInput[]
    ): Promise<UpdateClassEntityMap> {
        const classMap = await getMap.class(
            inputs.map((i) => i.classId),
            ['organization']
        )

        const classOrgsMap = new Map<string, Organization>()
        for (const cls of classMap.values()) {
            // eslint-disable-next-line no-await-in-loop
            const classOrg = await cls.organization
            if (classOrg) classOrgsMap.set(cls.class_id, classOrg)
        }

        const inputClassNames = inputs
            .map((cls) => cls.className)
            .filter((name): name is string => name !== undefined)
        const inputClassShortcodes = inputs
            .map((cls) => cls.shortcode)
            .filter((shortcode): shortcode is string => shortcode !== undefined)

        const existingClassesWithMatchingNames = await Class.find({
            where: [{ class_name: In(inputClassNames) }],
            relations: ['organization'],
        })
        const existingClassesWithMatchingShortcodes = await Class.find({
            where: [{ shortcode: In(inputClassShortcodes) }],
            relations: ['organization'],
        })

        const matchingNamesMap = new ObjMap<
            { className: string; orgId: string },
            Class
        >()
        for (const cls of existingClassesWithMatchingNames) {
            // eslint-disable-next-line no-await-in-loop
            const orgId = (await cls.organization)?.organization_id
            const key = {
                // Guaranteed to be populated given previous Class.find for classes with shortcodes
                className: cls.class_name!,
                orgId: orgId ? orgId : '',
            }
            matchingNamesMap.set(key, cls)
        }

        const matchingShortcodesMap = new ObjMap<
            { classShortcode: string; orgId: string },
            Class
        >()
        for (const cls of existingClassesWithMatchingShortcodes) {
            // eslint-disable-next-line no-await-in-loop
            const orgId = (await cls.organization)?.organization_id
            const key = {
                // Guaranteed to be populated given previous Class.find for classes with shortcodes
                classShortcode: cls.shortcode!,
                orgId: orgId ? orgId : '',
            }
            matchingShortcodesMap.set(key, cls)
        }

        return {
            mainEntity: classMap,
            classOrgs: classOrgsMap,
            existingOrgClassesWithMatchingNames: matchingNamesMap,
            existingOrgClassesWithMatchingShortcodes: matchingShortcodesMap,
        }
    }

    async authorize(
        inputs: UpdateClassInput[],
        entityMaps: UpdateClassEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: Array.from(entityMaps.classOrgs.values()).map(
                    (org) => org.organization_id
                ),
            },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: UpdateClassInput[],
        entityMaps: UpdateClassEntityMap
    ) {
        const errorMaps: Map<number, APIError>[] = []

        // Check for duplicate class IDs in input
        errorMaps.push(
            validateNoDuplicate(
                inputs.map((cls) => cls.classId),
                this.inputTypeName,
                'classId'
            )
        )

        // Check for duplicate (orgId, className) entries in input
        errorMaps.push(
            validateNoDuplicateAttribute(
                inputs.map((cls) => {
                    return {
                        entityId: entityMaps.classOrgs.get(cls.classId)
                            ?.organization_id,
                        attributeValue: cls.className,
                    }
                }),
                'Class',
                'className'
            )
        )

        // Check for duplicate (orgId, classShortcode) entries in input
        errorMaps.push(
            validateNoDuplicateAttribute(
                inputs.map((cls) => {
                    return {
                        entityId: entityMaps.classOrgs.get(cls.classId)
                            ?.organization_id,
                        attributeValue: cls.shortcode,
                    }
                }),
                'Class',
                'shortcode'
            )
        )

        return filterInvalidInputs(inputs, errorMaps)
    }

    validate(
        index: number,
        _currentEntity: undefined,
        currentInput: UpdateClassInput,
        maps: UpdateClassEntityMap
    ): APIError[] {
        const errors: APIError[] = []

        // Check for non-existent class ID in input
        const { errors: classErrors } = flagNonExistent(
            Class,
            index,
            [currentInput.classId],
            maps.mainEntity
        )
        errors.push(...classErrors)
        if (errors.length) {
            // If class ID is invalid, then we cannot validate attributes so we return errors here
            return errors
        }

        // Determine org of class to prepare for name/shortcode validation
        const currentClassOrgId = maps.classOrgs.get(currentInput.classId)
            ?.organization_id

        // Check for classes with matching names, either in the same org, or among classes with no orgs
        if (currentInput.className) {
            const matchingOrgAndName = maps.existingOrgClassesWithMatchingNames.get(
                {
                    className: currentInput.className,
                    orgId: currentClassOrgId ? currentClassOrgId : '',
                }
            )

            if (
                matchingOrgAndName &&
                matchingOrgAndName.class_id !== currentInput.classId
            ) {
                if (currentClassOrgId) {
                    // For duplicate names of classes with the same org
                    errors.push(
                        createEntityAPIError(
                            'existentChild',
                            index,
                            'Class',
                            currentInput.className,
                            'Organization',
                            currentClassOrgId,
                            ['organizationId', 'className']
                        )
                    )
                } else {
                    // For duplicate names of classes without an org
                    logger.info(
                        `During UpdateClasses input className validation, class ${currentInput.classId} without an org was passed in`
                    )
                    errors.push(
                        createEntityAPIError(
                            'existent',
                            index,
                            'Class',
                            currentInput.className
                        )
                    )
                }
            }
        }

        if (currentInput.shortcode) {
            // First validate the shortcode - record any errors
            errors.push(
                ...newValidateShortCode('Class', currentInput.shortcode, index)
            )

            // Check for classes with matching shortcodes, either in the same org, or among classes with no orgs
            const matchingOrgAndShortcode = maps.existingOrgClassesWithMatchingShortcodes.get(
                {
                    classShortcode: currentInput.shortcode,
                    orgId: currentClassOrgId ? currentClassOrgId : '',
                }
            )

            if (
                matchingOrgAndShortcode &&
                matchingOrgAndShortcode.class_id !== currentInput.classId
            ) {
                if (currentClassOrgId) {
                    // For duplicate shortcodes of classes with the same org
                    errors.push(
                        createEntityAPIError(
                            'existentChild',
                            index,
                            'Class',
                            currentInput.shortcode,
                            'Organization',
                            currentClassOrgId,
                            ['organizationId', 'shortcode']
                        )
                    )
                } else {
                    // For duplicate shortcodes of classes without an org
                    logger.info(
                        `During UpdateClasses input shortcode validation, class ${currentInput.classId} without an org was passed in`
                    )
                    errors.push(
                        createEntityAPIError(
                            'existent',
                            index,
                            'Class',
                            currentInput.shortcode
                        )
                    )
                }
            }
        }

        return errors
    }

    process(
        currentInput: UpdateClassInput,
        maps: UpdateClassEntityMap
    ): { outputEntity: Class } {
        const classToOutput = maps.mainEntity.get(currentInput.classId)!

        if (currentInput.className) {
            classToOutput.class_name = currentInput.className
        }

        if (currentInput.shortcode) {
            classToOutput.shortcode = currentInput.shortcode
        }

        return { outputEntity: classToOutput }
    }

    async buildOutput(outputEntity: Class): Promise<void> {
        this.output.classes.push(mapClassToClassConnectionNode(outputEntity))
    }
}

export interface AddStudentsClassesEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    students: Map<string, User>
    classesStudents: Map<string, User[]>
    organizationIds: string[]
    studentsMemberships: OrganizationMembershipMap
}

export class AddStudentsToClasses extends AddMutation<
    Class,
    AddStudentsToClassInput,
    ClassesMutationResult,
    AddStudentsClassesEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'AddStudentsToClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: AddStudentsToClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: AddStudentsToClassInput[]
    ): Promise<AddStudentsClassesEntityMap> => {
        const classIds = input.map((i) => i.classId)
        const classMap = getMap.class(classIds, ['organization', 'students'])
        const organizationIds = await Promise.all(
            Array.from((await classMap).values()).map(
                async (c) => (await c.organization!).organization_id
            )
        )
        const studentIds = input.flatMap((i) => i.studentIds)
        const studentMap = getMap.user(studentIds, ['memberships'])
        const studentsMemberships: OrganizationMembershipMap = new ObjMap<
            { organizationId: string; userId: string },
            OrganizationMembership
        >()
        for (const student of Array.from((await studentMap).values())) {
            // eslint-disable-next-line no-await-in-loop
            for (const membership of (await student.memberships) as OrganizationMembership[]) {
                studentsMemberships.set(
                    {
                        organizationId: membership.organization_id,
                        userId: student.user_id,
                    },
                    membership
                )
            }
        }
        const classesStudents = new Map<string, User[]>()
        for (const class_ of (await classMap).values()) {
            // eslint-disable-next-line no-await-in-loop
            const students = (await class_.students) || []
            classesStudents.set(class_.class_id, students)
        }

        return {
            mainEntity: await classMap,
            students: await studentMap,
            classesStudents,
            studentsMemberships,
            organizationIds,
        }
    }

    async authorize(
        input: AddStudentsToClassInput[],
        maps: AddStudentsClassesEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.add_students_to_class_20225
        )
    }

    validationOverAllInputs(
        inputs: AddStudentsToClassInput[]
    ): {
        validInputs: { index: number; input: AddStudentsToClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            'classId'
        )

        const studentIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'studentIds'
        )

        return filterInvalidInputs(inputs, [
            classIdErrorMap,
            ...studentIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        currentEntity: Class,
        currentInput: AddStudentsToClassInput,
        maps: AddStudentsClassesEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, studentIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const currentClassStudents = new Map(
            maps.classesStudents.get(classId)?.map((u) => [u.user_id, u])
        )

        const students = flagNonExistent(User, index, studentIds, maps.students)
        errors.push(...students.errors)

        const alreadyAdded = flagExistent(
            User,
            index,
            students.values.map((u) => u.user_id),
            currentClassStudents
        )
        errors.push(...alreadyAdded.errors)

        const classOrgId = (currentEntity as ClassAndOrg).__organization__
            ?.organization_id as string

        const dbMemberships = flagNonExistentOrganizationMembership(
            index,
            classOrgId,
            studentIds,
            maps.studentsMemberships
        )
        if (dbMemberships.errors) errors.push(...dbMemberships.errors)

        return errors
    }

    process(
        currentInput: AddStudentsToClassInput,
        maps: AddStudentsClassesEntityMap,
        index: number
    ) {
        const { classId, studentIds } = currentInput

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const studentsToAdd: User[] = []
        for (const studentId of studentIds) {
            const studentToAdd = maps.students.get(studentId)!
            studentsToAdd.push(studentToAdd)
        }
        const preExistentStudents = maps.classesStudents.get(classId)!
        currentEntity.students = Promise.resolve([
            ...preExistentStudents,
            ...studentsToAdd,
        ])
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export interface RemoveStudentsClassesEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    students: Map<string, User>
    classesStudents: Map<string, User[]>
    organizationIds: string[]
    schoolIds: string[]
}

export class RemoveStudentsFromClasses extends RemoveMutation<
    Class,
    RemoveStudentsFromClassInput,
    ClassesMutationResult,
    RemoveStudentsClassesEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'RemoveStudentsFromClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: RemoveStudentsFromClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: RemoveStudentsFromClassInput[]
    ): Promise<RemoveStudentsClassesEntityMap> => {
        const classIds = input.map((i) => i.classId)
        const classMap = getMap.class(classIds, [
            'organization',
            'students',
            'schools',
        ])
        const organizationIds = await Promise.all(
            Array.from((await classMap).values()).map(
                async (c) => (await c.organization!).organization_id
            )
        )
        const studentIds = input.flatMap((i) => i.studentIds)
        const studentMap = getMap.user(studentIds, ['memberships'])
        const classesStudents = new Map<string, User[]>()
        const schoolIds: Set<string> = new Set()
        for (const class_ of (await classMap).values()) {
            // eslint-disable-next-line no-await-in-loop
            const students = (await class_.students) || []
            classesStudents.set(class_.class_id, students)
            const schools = await class_.schools
            if (schools) {
                for (const school of schools) {
                    schoolIds.add(school.school_id)
                }
            }
        }

        return {
            mainEntity: await classMap,
            students: await studentMap,
            classesStudents,
            organizationIds,
            schoolIds: Array.from(schoolIds),
        }
    }

    async authorize(
        input: RemoveStudentsFromClassInput[],
        maps: RemoveStudentsClassesEntityMap
    ): Promise<void> {
        const permissionContext = {
            organization_ids: maps.organizationIds,
            school_ids: maps.schoolIds,
        }
        return this.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_student_from_class_roster_20445
        )
    }

    validationOverAllInputs(
        inputs: RemoveStudentsFromClassInput[]
    ): {
        validInputs: { index: number; input: RemoveStudentsFromClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            'classId'
        )

        const studentIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'studentIds'
        )

        return filterInvalidInputs(inputs, [
            classIdErrorMap,
            ...studentIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        currentEntity: Class,
        currentInput: RemoveStudentsFromClassInput,
        maps: RemoveStudentsClassesEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, studentIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const students = flagNonExistent(User, index, studentIds, maps.students)
        errors.push(...students.errors)

        const currentClassStudents = new Map(
            maps.classesStudents.get(classId)?.map((u) => [u.user_id, u])
        )

        const studentInClassErrors = flagNonExistentChild(
            Class,
            User,
            index,
            classId,
            studentIds,
            new Set(
                Array.from(currentClassStudents.values()).map(
                    (student) => student.user_id
                )
            )
        )

        errors.push(...studentInClassErrors)

        return errors
    }

    process(
        currentInput: RemoveStudentsFromClassInput,
        maps: RemoveStudentsClassesEntityMap,
        index: number
    ) {
        const { classId, studentIds } = currentInput
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const studentIdsSet = new Set(studentIds)
        const preExistentStudents = maps.classesStudents.get(classId)!

        const keptStudents = preExistentStudents.filter(
            (student) => !studentIdsSet.has(student.user_id)
        )
        currentEntity.students = Promise.resolve(keptStudents)
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export interface AddTeachersClassesEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    teachers: Map<string, User>
    teachersMemberships: OrganizationMembershipMap
    classesTeachers: Map<string, User[]>
    organizationIds: string[]
}

export class AddTeachersToClasses extends AddMutation<
    Class,
    AddTeachersToClassInput,
    ClassesMutationResult,
    AddTeachersClassesEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'AddTeachersToClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: AddTeachersToClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: AddTeachersToClassInput[]
    ): Promise<AddTeachersClassesEntityMap> => {
        const classIds = input.map((i) => i.classId)
        const classMap = getMap.class(classIds, ['organization', 'teachers'])
        const organizationIds = await Promise.all(
            Array.from((await classMap).values()).map(
                async (c) => (await c.organization!).organization_id
            )
        )
        const teacherIds = input.flatMap((i) => i.teacherIds)
        const teacherMap = getMap.user(teacherIds, ['memberships'])
        const teachersMemberships: OrganizationMembershipMap = new ObjMap<
            { organizationId: string; userId: string },
            OrganizationMembership
        >()
        for (const teacher of Array.from((await teacherMap).values())) {
            // eslint-disable-next-line no-await-in-loop
            for (const membership of (await teacher.memberships) as OrganizationMembership[]) {
                teachersMemberships.set(
                    {
                        organizationId: membership.organization_id,
                        userId: teacher.user_id,
                    },
                    membership
                )
            }
        }
        const classesTeachers = new Map<string, User[]>()
        for (const class_ of (await classMap).values()) {
            // eslint-disable-next-line no-await-in-loop
            const teachers = (await class_.teachers) || []
            classesTeachers.set(class_.class_id, teachers)
        }

        return {
            mainEntity: await classMap,
            teachers: await teacherMap,
            classesTeachers,
            teachersMemberships,
            organizationIds,
        }
    }

    async authorize(
        input: AddTeachersToClassInput[],
        maps: AddTeachersClassesEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.add_teachers_to_class_20226
        )
    }

    validationOverAllInputs(
        inputs: AddTeachersToClassInput[]
    ): {
        validInputs: { index: number; input: AddTeachersToClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            'classId'
        )

        const teacherIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'teacherIds'
        )

        return filterInvalidInputs(inputs, [
            classIdErrorMap,
            ...teacherIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        currentEntity: Class,
        currentInput: AddTeachersToClassInput,
        maps: AddTeachersClassesEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, teacherIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const currentClassTeachers = new Map(
            maps.classesTeachers.get(classId)?.map((u) => [u.user_id, u])
        )

        const teachers = flagNonExistent(User, index, teacherIds, maps.teachers)
        errors.push(...teachers.errors)

        const alreadyAdded = flagExistent(
            User,
            index,
            teachers.values.map((u) => u.user_id),
            currentClassTeachers
        )
        errors.push(...alreadyAdded.errors)

        if (currentEntity) {
            const classOrgId = (currentEntity as ClassAndOrg).__organization__
                ?.organization_id as string

            const dbMemberships = flagNonExistentOrganizationMembership(
                index,
                classOrgId,
                teacherIds,
                maps.teachersMemberships
            )
            if (dbMemberships.errors) errors.push(...dbMemberships.errors)
        }

        return errors
    }

    process(
        currentInput: AddTeachersToClassInput,
        maps: AddTeachersClassesEntityMap,
        index: number
    ) {
        const { classId, teacherIds } = currentInput

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const teachersToAdd: User[] = []
        for (const teacherId of teacherIds) {
            const teacherToAdd = maps.teachers.get(teacherId)!
            teachersToAdd.push(teacherToAdd)
        }
        const preExistentTeachers = maps.classesTeachers.get(classId)!
        currentEntity.teachers = Promise.resolve([
            ...preExistentTeachers,
            ...teachersToAdd,
        ])
        return { outputEntity: currentEntity }
    }

    protected async buildOutput(currentEntity: Class): Promise<void> {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

type ClassAndOrg = Class & {
    __organization__?: Organization
}
