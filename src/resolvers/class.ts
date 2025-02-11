import { Brackets, getConnection, getManager, getRepository, In } from 'typeorm'
import { Context } from '../main'
import {
    DeleteClassInput,
    ClassesMutationResult,
    AddProgramsToClassInput,
    RemoveProgramsFromClassInput,
    CreateClassInput,
    UpdateClassInput,
    AddStudentsToClassInput,
    RemoveStudentsFromClassInput,
    AddTeachersToClassInput,
    RemoveTeachersFromClassInput,
    SetAcademicTermOfClassInput,
    MoveUsersToClassInput,
    MoveUsersToClassMutationResult,
    AddAgeRangesToClassInput,
    RemoveSubjectsFromClassInput,
    RemoveAgeRangesFromClassInput,
    AddSubjectsToClassInput,
    AddGradesToClassInput,
    RemoveGradesFromClassInput,
} from '../types/graphQL/class'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { Class } from '../entities/class'
import { PermissionName } from '../permissions/permissionNames'
import {
    createDuplicateChildEntityAttributeAPIError,
    createDuplicateInputAttributeAPIError,
    createEntityAPIError,
    createMustHaveExactlyNAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers/errors'
import { mapClassToClassConnectionNode } from '../pagination/classesConnection'
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
    DeleteEntityMap,
    DeleteMutation,
    SetMutation,
} from '../utils/resolvers/commonStructure'
import { Organization } from '../entities/organization'
import {
    generateShortCode,
    validateShortCode,
    newValidateShortCode,
} from '../utils/shortcode'
import clean, { uniqueAndTruthy } from '../utils/clean'
import { ObjMap } from '../utils/stringUtils'
import {
    getMap,
    OrganizationMembershipMap,
} from '../utils/resolvers/entityMaps'
import {
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
    validateSubItemsInOrg,
} from '../utils/resolvers/inputValidation'
import logger from '../logging'
import { User } from '../entities/user'
import { OrganizationMembership } from '../entities/organizationMembership'
import { AcademicTerm } from '../entities/academicTerm'
import { School } from '../entities/school'
import { customErrors } from '../types/errors/customError'
import { AgeRange } from '../entities/ageRange'
import { Subject } from '../entities/subject'
import { Grade } from '../entities/grade'

export class DeleteClasses extends DeleteMutation<
    Class,
    DeleteClassInput,
    ClassesMutationResult
> {
    protected readonly EntityType = Class
    protected readonly inputTypeName = 'DeleteClassInput'
    protected readonly output: ClassesMutationResult = { classes: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(): Promise<DeleteEntityMap<Class>> {
        return { mainEntity: await getMap.class(this.mainEntityIds) }
    }

    protected async authorize(
        _input: DeleteClassInput[],
        entityMaps: DeleteEntityMap<Class>
    ) {
        const organizationIds = uniqueAndTruthy(
            Array.from(entityMaps.mainEntity.values()).map(
                (c) => c.organization_id
            )
        )
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_class_20444
        )
    }

    protected async buildOutput(currentEntity: Class): Promise<void> {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export interface EntityMapAddRemovePrograms extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    programs: Map<string, Program>
    classPrograms: Map<string, Program[]>
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
        const organization_ids = uniqueAndTruthy(
            Array.from(maps.mainEntity.values(), (c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids },
            PermissionName.edit_class_20334
        )
    }

    protected validationOverAllInputs(
        inputs: AddProgramsToClassInput[]
    ): {
        validInputs: { index: number; input: AddProgramsToClassInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            validateNoDuplicate(
                inputs.map((val) => val.classId),
                this.inputTypeName,
                ['classId']
            ),
        ])
    }

    protected validate(
        index: number,
        _currentClass: Class,
        currentInput: AddProgramsToClassInput,
        maps: EntityMapAddRemovePrograms
    ): APIError[] {
        const errors: APIError[] = []
        const { classId, programIds } = currentInput

        const classExists = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classExists.errors)

        const programMap = maps.programs
        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...programs.errors)

        if (errors.length) return errors

        const programsNotInOrgError = validateSubItemsInOrg(
            Program,
            programIds,
            index,
            programMap,
            classExists.values[0].organization_id
        )
        errors.push(...programsNotInOrgError)

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
        const organization_ids = uniqueAndTruthy(
            Array.from(maps.mainEntity.values(), (c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids },
            PermissionName.edit_class_20334
        )
    }

    protected validationOverAllInputs(
        inputs: RemoveProgramsFromClassInput[]
    ): {
        validInputs: { index: number; input: RemoveProgramsFromClassInput }[]
        apiErrors: APIError[]
    } {
        const validateSubItems = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'programIds'
        )

        const validateNoDup = validateNoDuplicate(
            inputs.map((val) => val.classId),
            this.inputTypeName,
            ['classId']
        )

        return filterInvalidInputs(inputs, [validateNoDup, ...validateSubItems])
    }

    protected validate = (
        index: number,
        _currentClass: Class,
        currentInput: RemoveProgramsFromClassInput,
        maps: EntityMapAddRemovePrograms
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, programIds } = currentInput

        const classExists = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classExists.errors)

        const programMap = maps.programs
        const programs = flagNonExistent(Program, index, programIds, programMap)
        errors.push(...programs.errors)

        if (errors.length) return errors
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
        this.output.classes.push(mapClassToClassConnectionNode(currentClass))
    }
}

async function generateMapsForAddingRemovingPrograms(
    classIds: string[],
    input: AddProgramsToClassInput[]
): Promise<EntityMapAddRemovePrograms> {
    const programIds = input.flatMap((i) => i.programIds)
    const programs = getMap.program(programIds)

    const classes = await getMap.class(classIds, ['programs'])
    const classPrograms = new Map<string, Program[]>()
    for (const class_ of classes.values()) {
        // eslint-disable-next-line no-await-in-loop
        classPrograms.set(class_.class_id, (await class_.programs) || [])
    }

    return {
        mainEntity: classes,
        programs: await programs,
        classPrograms,
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
        const orgIds = input.map((i) => i.organizationId)
        const orgMap = getMap.organization(orgIds)

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
            .andWhere('class.organizationOrganizationId IN (:...orgIds)', {
                orgIds,
            })
            .getRawMany()

        return {
            organizations: await orgMap,
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

        const failedDuplicateNames = validateNoDuplicateAttribute(
            inputs.map((i) => {
                return {
                    entityId: i.organizationId,
                    attributeValue: i.name,
                }
            }),
            'organizationId',
            'name'
        )

        errors.push(...failedDuplicateNames.values())

        const failedDuplicateShortcodes = validateNoDuplicate(
            inputs.map((i) => [i.organizationId, i.shortcode!].toString()),
            'class',
            ['shortcode']
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
        const classMap = await getMap.class(inputs.map((i) => i.classId))

        const inputClassNames = inputs
            .map((cls) => cls.className)
            .filter((name): name is string => name !== undefined)
        const inputClassShortcodes = inputs
            .map((cls) => cls.shortcode)
            .filter((shortcode): shortcode is string => shortcode !== undefined)

        const existingClassesWithMatchingNames = await Class.find({
            where: [{ class_name: In(inputClassNames) }],
        })
        const existingClassesWithMatchingShortcodes = await Class.find({
            where: [{ shortcode: In(inputClassShortcodes) }],
        })

        const matchingNamesMap = new ObjMap<
            { className: string; orgId: string },
            Class
        >()
        for (const cls of existingClassesWithMatchingNames) {
            const orgId = cls.organization_id
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
            const orgId = cls.organization_id
            const key = {
                // Guaranteed to be populated given previous Class.find for classes with shortcodes
                classShortcode: cls.shortcode!,
                orgId: orgId ? orgId : '',
            }
            matchingShortcodesMap.set(key, cls)
        }

        return {
            mainEntity: classMap,
            existingOrgClassesWithMatchingNames: matchingNamesMap,
            existingOrgClassesWithMatchingShortcodes: matchingShortcodesMap,
        }
    }

    async authorize(
        _inputs: UpdateClassInput[],
        entityMaps: UpdateClassEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(entityMaps.mainEntity.values(), (c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
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
                ['classId']
            )
        )

        // Check for duplicate (orgId, className) entries in input
        errorMaps.push(
            validateNoDuplicateAttribute(
                inputs.map((cls) => {
                    return {
                        entityId: entityMaps.mainEntity.get(cls.classId)
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
                        entityId: entityMaps.mainEntity.get(cls.classId)
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
        const {
            errors: classErrors,
            values: [cls],
        } = flagNonExistent(
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

        // Check for classes with matching names, either in the same org, or among classes with no orgs
        if (currentInput.className) {
            const matchingOrgAndName = maps.existingOrgClassesWithMatchingNames.get(
                {
                    className: currentInput.className,
                    orgId: cls.organization_id ?? '',
                }
            )

            if (
                matchingOrgAndName &&
                matchingOrgAndName.class_id !== currentInput.classId
            ) {
                if (cls.organization_id) {
                    // For duplicate names of classes with the same org
                    errors.push(
                        createEntityAPIError(
                            'existentChild',
                            index,
                            'Class',
                            currentInput.className,
                            'Organization',
                            cls.organization_id,
                            ['organizationId', 'className']
                        )
                    )
                } else {
                    // For duplicate names of classes without an org
                    logger.warn(
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
                    orgId: cls.organization_id ?? '',
                }
            )

            if (
                matchingOrgAndShortcode &&
                matchingOrgAndShortcode.class_id !== currentInput.classId
            ) {
                if (cls.organization_id) {
                    // For duplicate shortcodes of classes with the same org
                    errors.push(
                        createEntityAPIError(
                            'existentChild',
                            index,
                            'Class',
                            currentInput.shortcode,
                            'Organization',
                            cls.organization_id,
                            ['organizationId', 'shortcode']
                        )
                    )
                } else {
                    // For duplicate shortcodes of classes without an org
                    logger.warn(
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
        const classMap = getMap.class(classIds, ['students'])

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
        }
    }

    async authorize(
        _input: AddStudentsToClassInput[],
        maps: AddStudentsClassesEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
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
            ['classId']
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

        const currentClassStudents = new Set(
            maps.classesStudents.get(classId)?.map((u) => u.user_id)
        )

        const students = flagNonExistent(User, index, studentIds, maps.students)
        errors.push(...students.errors)

        const alreadyAddedErrors = flagExistentChild(
            Class,
            User,
            index,
            classId,
            studentIds,
            currentClassStudents
        )

        errors.push(...alreadyAddedErrors)

        if (currentEntity) {
            const classOrgId = currentEntity.organization_id!

            const dbMemberships = flagNonExistentOrganizationMembership(
                index,
                classOrgId,
                studentIds,
                maps.studentsMemberships
            )
            if (dbMemberships.errors) errors.push(...dbMemberships.errors)
        }

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
        const classMap = getMap.class(classIds, ['students', 'schools'])
        const studentIds = input.flatMap((i) => i.studentIds)
        const studentMap = getMap.user(studentIds, ['memberships'])

        const classesStudents = new Map<string, User[]>()
        const schoolIds: Set<string> = new Set()
        for (const class_ of (await classMap).values()) {
            // eslint-disable-next-line no-await-in-loop
            const students = (await class_.students) || []
            classesStudents.set(class_.class_id, students)
            // eslint-disable-next-line no-await-in-loop
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
            schoolIds: Array.from(schoolIds),
        }
    }

    async authorize(
        _input: RemoveStudentsFromClassInput[],
        maps: RemoveStudentsClassesEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((c) => c.organization_id)
        )
        const permissionContext = {
            organization_ids: organizationIds,
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
            ['classId']
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

        if (currentEntity) {
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
        }

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
        const classMap = getMap.class(classIds, ['teachers'])
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
        }
    }

    async authorize(
        _input: AddTeachersToClassInput[],
        maps: AddTeachersClassesEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
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
            ['classId']
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

        const currentClassTeachers = new Set(
            maps.classesTeachers.get(classId)?.map((u) => u.user_id)
        )

        const teachers = flagNonExistent(User, index, teacherIds, maps.teachers)
        errors.push(...teachers.errors)

        const alreadyAddedErrors = flagExistentChild(
            Class,
            User,
            index,
            classId,
            teacherIds,
            currentClassTeachers
        )
        errors.push(...alreadyAddedErrors)

        if (currentEntity) {
            const classOrgId = currentEntity.organization_id!

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

export interface RemoveTeachersClassesEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    teachers: Map<string, User>
    classesTeachers: Map<string, User[]>
    schoolIds: string[]
}

export class RemoveTeachersFromClasses extends RemoveMutation<
    Class,
    RemoveTeachersFromClassInput,
    ClassesMutationResult,
    RemoveTeachersClassesEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'RemoveTeachersFromClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: RemoveTeachersFromClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: RemoveTeachersFromClassInput[]
    ): Promise<RemoveTeachersClassesEntityMap> => {
        const classIds = input.map((i) => i.classId)
        const classMap = getMap.class(classIds, ['teachers', 'schools'])
        const teacherIds = input.flatMap((i) => i.teacherIds)
        const teacherMap = getMap.user(teacherIds, ['memberships'])

        const classesTeachers = new Map<string, User[]>()
        const schoolIds: Set<string> = new Set()
        for (const class_ of (await classMap).values()) {
            // eslint-disable-next-line no-await-in-loop
            const teachers = (await class_.teachers) || []
            classesTeachers.set(class_.class_id, teachers)
            // eslint-disable-next-line no-await-in-loop
            const schools = await class_.schools
            if (schools) {
                for (const school of schools) {
                    schoolIds.add(school.school_id)
                }
            }
        }

        return {
            mainEntity: await classMap,
            teachers: await teacherMap,
            classesTeachers,
            schoolIds: Array.from(schoolIds),
        }
    }

    async authorize(
        _input: RemoveTeachersFromClassInput[],
        maps: RemoveTeachersClassesEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((c) => c.organization_id)
        )
        const permissionContext = {
            organization_ids: organizationIds,
            school_ids: maps.schoolIds,
        }
        return this.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_teacher_from_class_20446
        )
    }

    validationOverAllInputs(
        inputs: RemoveTeachersFromClassInput[]
    ): {
        validInputs: { index: number; input: RemoveTeachersFromClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            ['classId']
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
        currentInput: RemoveTeachersFromClassInput,
        maps: RemoveTeachersClassesEntityMap
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

        const teachers = flagNonExistent(User, index, teacherIds, maps.teachers)
        errors.push(...teachers.errors)

        if (currentEntity) {
            const currentClassTeachers = new Map(
                maps.classesTeachers.get(classId)?.map((u) => [u.user_id, u])
            )
            const existingTeacherIds = teachers.values.map((t) => t.user_id)
            const teacherInClassErrors = flagNonExistentChild(
                Class,
                User,
                index,
                classId,
                existingTeacherIds,
                new Set(
                    Array.from(currentClassTeachers.values()).map(
                        (teacher) => teacher.user_id
                    )
                )
            )

            errors.push(...teacherInClassErrors)
        }

        return errors
    }

    process(
        currentInput: RemoveTeachersFromClassInput,
        maps: RemoveTeachersClassesEntityMap,
        index: number
    ) {
        const { classId, teacherIds } = currentInput
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const teacherIdsSet = new Set(teacherIds)
        const preExistentTeachers = maps.classesTeachers.get(classId)!

        const keptTeachers = preExistentTeachers.filter(
            (teacher) => !teacherIdsSet.has(teacher.user_id)
        )
        currentEntity.teachers = Promise.resolve(keptTeachers)
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export interface SetAcademicTermEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    academicTerm: Map<string, AcademicTerm>
    classSchools: Map<string, School[]>
}

export class SetAcademicTermsOfClasses extends SetMutation<
    Class,
    SetAcademicTermOfClassInput,
    ClassesMutationResult,
    SetAcademicTermEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'SetAcademicTermOfClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: SetAcademicTermOfClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    async generateEntityMaps(
        input: SetAcademicTermOfClassInput[]
    ): Promise<SetAcademicTermEntityMap> {
        const termIds = input
            .map((i) => i.academicTermId)
            .filter((id): id is string => !!id)
        const termMap = getMap.academicTerm(termIds)
        const classIds = input.map((i) => i.classId)
        const classMap = await getMap.class(classIds, ['schools'])

        const classSchools = new Map<string, School[]>()
        for (const class_ of classMap.values()) {
            // eslint-disable-next-line no-await-in-loop
            classSchools.set(class_.class_id, (await class_.schools) || [])
        }

        return {
            mainEntity: classMap,
            academicTerm: await termMap,
            classSchools: classSchools,
        }
    }

    async authorize(
        _input: SetAcademicTermOfClassInput[],
        maps: SetAcademicTermEntityMap
    ): Promise<void> {
        const organization_ids: string[] = []
        const school_ids: string[] = []
        for (const cls of maps.mainEntity.values()) {
            if (cls.organization_id) organization_ids.push(cls.organization_id)
            // eslint-disable-next-line no-await-in-loop
            for (const school of (await cls.schools) || []) {
                school_ids.push(school.school_id)
            }
        }

        return this.permissions.rejectIfNotAllowed(
            { organization_ids, school_ids },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: SetAcademicTermOfClassInput[]
    ): {
        validInputs: { index: number; input: SetAcademicTermOfClassInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            validateNoDuplicate(
                inputs.map((c) => c.classId),
                this.inputTypeName,
                ['classId']
            ),
        ])
    }

    validate(
        index: number,
        _currentClass: Class | undefined,
        currentInput: SetAcademicTermOfClassInput,
        maps: SetAcademicTermEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { classId, academicTermId } = currentInput

        const cls = maps.mainEntity.get(classId)
        if (!cls) {
            errors.push(
                createEntityAPIError('nonExistent', index, 'Class', classId)
            )
            return errors
        }

        const schools = maps.classSchools.get(classId)
        if (schools?.length !== 1) {
            errors.push(
                createMustHaveExactlyNAPIError(
                    'Class',
                    cls.class_id,
                    'School',
                    1,
                    index
                )
            )
            return errors
        }

        if (!academicTermId) return errors

        const academicTerm = maps.academicTerm.get(academicTermId)
        if (!academicTerm) {
            errors.push(
                createEntityAPIError(
                    'nonExistent',
                    index,
                    'AcademicTerm',
                    academicTermId
                )
            )
            return errors
        }

        const schoolId = schools[0].school_id
        if (schoolId !== academicTerm.school_id) {
            errors.push(
                createEntityAPIError(
                    'nonExistentChild',
                    index,
                    'AcademicTerm',
                    academicTermId,
                    'School',
                    schoolId
                )
            )
        }

        if (!cls.organization_id) {
            errors.push(
                createMustHaveExactlyNAPIError(
                    'Class',
                    cls.class_id,
                    'Organization',
                    1,
                    index
                )
            )
            return errors
        }

        if (schools[0].organization_id !== cls.organization_id) {
            errors.push(
                createEntityAPIError(
                    'nonExistentChild',
                    index,
                    'School',
                    schoolId,
                    'Organization',
                    cls.organization_id
                )
            )
        }

        return errors
    }

    protected process(
        currentInput: SetAcademicTermOfClassInput,
        maps: SetAcademicTermEntityMap,
        _index: number
    ) {
        const { classId, academicTermId } = currentInput

        const currentClass = maps.mainEntity.get(classId)!
        currentClass.academicTerm = Promise.resolve(
            academicTermId ? maps.academicTerm.get(academicTermId)! : null
        )

        return { outputEntity: currentClass }
    }

    protected buildOutput = async (currentClass: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentClass))
    }
}

export enum moveUsersTypeToClass {
    students,
    teachers,
}

export async function moveUsersToClassValidation(
    fromClassId: string,
    toClassId: string,
    userIds: string[],
    usersType: moveUsersTypeToClass
): Promise<Class[]> {
    const errors: APIError[] = []
    if (fromClassId === toClassId) {
        errors.push(
            createDuplicateInputAttributeAPIError(
                undefined,
                'fromClassId',
                fromClassId,
                'toClassId',
                toClassId
            )
        )
        throw new APIErrorCollection(errors)
    }
    const classes =
        (await getRepository(Class).find({
            where: { class_id: In([fromClassId, toClassId]) },
            relations: [
                'schools',
                usersType === moveUsersTypeToClass.students
                    ? 'students'
                    : 'teachers',
            ],
        })) || []

    switch (classes.length) {
        case 0:
            errors.push(
                ...[
                    createEntityAPIError(
                        'nonExistent',
                        undefined,
                        'Class',
                        fromClassId
                    ),
                    createEntityAPIError(
                        'nonExistent',
                        undefined,
                        'Class',
                        toClassId
                    ),
                ]
            )
            break
        case 1:
            errors.push(
                createEntityAPIError(
                    'nonExistent',
                    classes[0].class_id === fromClassId ? 1 : 0,
                    'Class',
                    classes[0].class_id === fromClassId
                        ? toClassId
                        : fromClassId
                )
            )
            break
        case 2:
            break
        default:
            throw new Error(
                `More than two classes returned from a search for two ids ${fromClassId} and ${toClassId}`
            )
    }

    if (errors.length > 0) {
        throw new APIErrorCollection(errors)
    }

    const [fromClass, toClass] =
        classes[0].class_id === fromClassId
            ? [classes[0], classes[1]]
            : [classes[1], classes[0]]

    const fromSchools = (await fromClass.schools) || []
    const toSchools = (await toClass.schools) || []

    if (fromClass.organization_id === undefined) {
        throw new Error(
            `FromClass ${fromClassId} belongs to no organization this should not occur`
        )
    }

    if (fromClass.organization_id != toClass.organization_id) {
        errors.push(
            new APIError({
                code: customErrors.src_and_destination_dont_match.code,
                message: customErrors.src_and_destination_dont_match.message,
                variables: ['classId', 'schoolId'],
                entity: 'Class',
                entityName: toClassId,
                otherAttribute: fromClassId,
                attribute: 'Organization',
                attributeValue: fromClass.organization_id,
            })
        )
    }

    // Check the related school(s)
    if (fromSchools.length > 1) {
        errors.push(
            new APIError({
                code: customErrors.too_many_relations.code,
                message: customErrors.too_many_relations.message,
                variables: ['classId', 'schoolId'],
                entity: 'Class',
                entityName: fromClassId,
                attribute: 'ID',
                otherAttribute: 'schools',
            })
        )
    }
    if (toSchools.length > 1) {
        errors.push(
            new APIError({
                code: customErrors.too_many_relations.code,
                message: customErrors.too_many_relations.message,
                variables: ['classId', 'schoolId'],
                entity: 'Class',
                entityName: toClassId,
                attribute: 'ID',
                max: 1,
                otherAttribute: 'schools',
            })
        )
    }
    if (errors.length > 0) throw new APIErrorCollection(errors)

    if (
        fromSchools.length != toSchools.length ||
        (fromSchools.length == 1 &&
            fromSchools[0].school_id != toSchools[0].school_id)
    ) {
        errors.push(
            new APIError({
                code: customErrors.src_and_destination_dont_match.code,
                message: customErrors.src_and_destination_dont_match.message,
                variables: ['classId', 'schoolId'],
                entity: 'Class',
                entityName: toClassId,
                attribute: 'schools',
                otherAttribute: fromClassId,
            })
        )
    }

    const dbUsers =
        usersType === moveUsersTypeToClass.students
            ? await fromClass.students
            : await fromClass.teachers

    const dbUserIds = dbUsers?.map((u) => u.user_id)

    const dbUserIdSet = new Set<string>(dbUserIds)
    let count = 0

    for (const id of userIds) {
        if (!dbUserIdSet.has(id)) {
            errors.push(
                new APIError({
                    code: customErrors.nonexistent_child.code,
                    message: customErrors.nonexistent_child.message,
                    variables: [
                        'classId',
                        usersType === moveUsersTypeToClass.students
                            ? 'studentId'
                            : 'teacherId',
                    ],
                    entity:
                        usersType === moveUsersTypeToClass.students
                            ? 'Student'
                            : 'Teacher',
                    entityName: id,
                    parentEntity: 'Class',
                    parentName: fromClassId,
                    index: count,
                })
            )
        }
        count++
    }
    if (errors.length > 0) throw new APIErrorCollection(errors)

    return [fromClass, toClass]
}

export async function moveUsersToClassAuthorization(
    fromClass: Class,
    usersType: moveUsersTypeToClass,
    context: Pick<Context, 'permissions'>
): Promise<void> {
    const fromSchools = (await fromClass.schools) || []
    const permissionContext = {
        organization_ids: [fromClass.organization_id!],
        school_ids: fromSchools.map((s) => s.school_id),
    }

    const permissions = context.permissions

    const permName =
        usersType === moveUsersTypeToClass.students
            ? PermissionName.move_students_to_another_class_20335
            : PermissionName.move_teachers_to_another_class_20340

    await permissions.rejectIfNotAllowed(permissionContext, permName)
}

export async function moveUsersToClassProcessAndWrite(
    fromClass: Class,
    toClass: Class,
    userIds: string[],
    usersType: moveUsersTypeToClass
): Promise<void> {
    const userIdSet = new Set<string>(userIds)
    if (usersType === moveUsersTypeToClass.students) {
        const students = (await fromClass.students) || []
        const existingStudents = (await toClass.students) || []
        const studentsToMove: User[] = []
        const studentsToLeave: User[] = []
        for (const s of students) {
            if (userIdSet.has(s.user_id)) {
                studentsToMove.push(s)
            } else {
                studentsToLeave.push(s)
            }
        }
        toClass.students = Promise.resolve(
            Array.from(new Set<User>(studentsToMove.concat(existingStudents)))
        )

        fromClass.students = Promise.resolve(studentsToLeave)
    } else {
        const teachers = (await fromClass.teachers) || []
        const existingTeachers = (await toClass.teachers) || []
        const teachersToMove: User[] = []
        const teachersToLeave: User[] = []
        for (const s of teachers) {
            if (userIdSet.has(s.user_id)) {
                teachersToMove.push(s)
            } else {
                teachersToLeave.push(s)
            }
        }

        toClass.teachers = Promise.resolve(
            Array.from(new Set<User>(teachersToMove.concat(existingTeachers)))
        )
        fromClass.teachers = Promise.resolve(teachersToLeave)
    }
    try {
        await getManager().save([fromClass, toClass])
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Class',
        })
    }
}

export async function moveUsersToClass(
    context: Pick<Context, 'permissions'>,
    input: MoveUsersToClassInput,
    usersType: moveUsersTypeToClass
): Promise<MoveUsersToClassMutationResult> {
    const fromClassId = input.fromClassId
    const toClassId = input.toClassId
    const userIds = input.userIds

    const [fromClass, toClass] = await moveUsersToClassValidation(
        fromClassId,
        toClassId,
        userIds,
        usersType
    )

    await moveUsersToClassAuthorization(fromClass, usersType, context)

    await moveUsersToClassProcessAndWrite(
        fromClass,
        toClass,
        userIds,
        usersType
    )

    return {
        fromClass: mapClassToClassConnectionNode(fromClass),
        toClass: mapClassToClassConnectionNode(toClass),
    }
}

export interface EntityMapAddRemoveAgeRanges extends EntityMap<Class> {
    mainEntity: Map<Class['class_id'], Class>
    inputAgeRanges: Map<AgeRange['id'], AgeRange>
    inputAgeRangeOrgs: Map<AgeRange['id'], Organization['organization_id']>
    existingClassAgeRanges: Map<Class['class_id'], AgeRange[]>
}

export class AddAgeRangesToClasses extends AddMutation<
    Class,
    AddAgeRangesToClassInput,
    ClassesMutationResult,
    EntityMapAddRemoveAgeRanges
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'AddAgeRangesToClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: AddAgeRangesToClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    async generateEntityMaps(
        input: AddAgeRangesToClassInput[]
    ): Promise<EntityMapAddRemoveAgeRanges> {
        return generateMapsForAddingRemovingAgeRanges(this.mainEntityIds, input)
    }

    async authorize(
        _input: AddAgeRangesToClassInput[],
        maps: EntityMapAddRemoveAgeRanges
    ): Promise<void> {
        const classOrgIds: string[] = []
        for (const class_ of Array.from(maps.mainEntity.values())) {
            if (class_.organization_id) {
                classOrgIds.push(class_.organization_id)
            }
        }

        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: classOrgIds,
            },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: AddAgeRangesToClassInput[],
        entityMaps: EntityMapAddRemoveAgeRanges
    ): {
        validInputs: { index: number; input: AddAgeRangesToClassInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            ...validateSubItemsLengthAndNoDuplicates(
                inputs,
                this.inputTypeName,
                'ageRangeIds'
            ),
            ...validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.classId),
                this.EntityType.name,
                this.inputTypeName,
                'classId'
            ),
        ])
    }

    validate(
        index: number,
        _currentEntity: undefined,
        currentInput: AddAgeRangesToClassInput,
        maps: EntityMapAddRemoveAgeRanges
    ): APIError[] {
        const errors: APIError[] = []
        const { classId, ageRangeIds } = currentInput

        // Does the current input contain a class ID which doesn't exist?
        const { errors: classErrors } = flagNonExistent(
            Class,
            index,
            [currentInput.classId],
            maps.mainEntity
        )
        errors.push(...classErrors)

        // Does the current input contain an age range ID which doesn't exist/is inactive?
        const { errors: ageRangeErrors } = flagNonExistent(
            AgeRange,
            index,
            currentInput.ageRangeIds,
            maps.inputAgeRanges
        )
        errors.push(...ageRangeErrors)

        if (errors.length) {
            return errors
        }

        // Do any of the inputted age range IDs not exist in the class's org?
        // Make exception for age ranges which are system age ranges
        const classOrgId = maps.mainEntity.get(classId)?.organization_id
        if (classOrgId) {
            for (const inputAgeRangeId of ageRangeIds) {
                const ageRangeOrgId = maps.inputAgeRangeOrgs.get(
                    inputAgeRangeId
                )
                if (ageRangeOrgId && ageRangeOrgId !== classOrgId) {
                    errors.push(
                        createEntityAPIError(
                            'nonExistentChild',
                            index,
                            AgeRange.name,
                            inputAgeRangeId,
                            Organization.name,
                            classOrgId
                        )
                    )
                }
            }
        }

        // Do any of the inputted age range IDs already exist in the class?
        const classAgeRanges = maps.existingClassAgeRanges.get(classId)
        if (classAgeRanges) {
            const ageRangeChildErrors = flagExistentChild(
                Class,
                AgeRange,
                index,
                classId,
                ageRangeIds,
                new Set(classAgeRanges.map((ageRange) => ageRange.id))
            )
            if (ageRangeChildErrors.length) errors.push(...ageRangeChildErrors)
        }

        return errors
    }

    process(
        currentInput: AddAgeRangesToClassInput,
        maps: EntityMapAddRemoveAgeRanges,
        index: number
    ) {
        const { classId, ageRangeIds } = currentInput

        const currentClass = maps.mainEntity.get(this.mainEntityIds[index])!

        const newAgeRanges: AgeRange[] = []
        for (const ageRangeId of ageRangeIds) {
            newAgeRanges.push(maps.inputAgeRanges.get(ageRangeId)!)
        }

        const preExistentAgeRanges = maps.existingClassAgeRanges.get(classId)!

        currentClass.age_ranges = Promise.resolve([
            ...preExistentAgeRanges,
            ...newAgeRanges,
        ])

        return { outputEntity: currentClass }
    }

    protected buildOutput = async (currentClass: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentClass))
    }
}

export class RemoveAgeRangesFromClasses extends RemoveMutation<
    Class,
    RemoveAgeRangesFromClassInput,
    ClassesMutationResult,
    EntityMapAddRemoveAgeRanges
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'RemoveAgeRangesFromClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: RemoveAgeRangesFromClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    async generateEntityMaps(
        input: RemoveAgeRangesFromClassInput[]
    ): Promise<EntityMapAddRemoveAgeRanges> {
        return generateMapsForAddingRemovingAgeRanges(this.mainEntityIds, input)
    }

    async authorize(
        _input: RemoveAgeRangesFromClassInput[],
        maps: EntityMapAddRemoveAgeRanges
    ): Promise<void> {
        const classOrgIds: string[] = []
        for (const class_ of Array.from(maps.mainEntity.values())) {
            if (class_.organization_id) {
                classOrgIds.push(class_.organization_id)
            }
        }

        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: classOrgIds,
            },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: RemoveAgeRangesFromClassInput[],
        entityMaps: EntityMapAddRemoveAgeRanges
    ): {
        validInputs: { index: number; input: RemoveAgeRangesFromClassInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            ...validateSubItemsLengthAndNoDuplicates(
                inputs,
                this.inputTypeName,
                'ageRangeIds'
            ),
            ...validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.classId),
                this.EntityType.name,
                this.inputTypeName,
                'classId'
            ),
        ])
    }

    validate(
        index: number,
        _currentClass: undefined,
        currentInput: RemoveAgeRangesFromClassInput,
        maps: EntityMapAddRemoveAgeRanges
    ): APIError[] {
        const errors: APIError[] = []
        const { classId, ageRangeIds } = currentInput

        // Does the current input contain a class ID which doesn't exist?
        const { errors: classErrors } = flagNonExistent(
            Class,
            index,
            [currentInput.classId],
            maps.mainEntity
        )
        errors.push(...classErrors)

        // Does the current input contain an age range ID which doesn't exist/is inactive?
        const { errors: ageRangeErrors } = flagNonExistent(
            AgeRange,
            index,
            currentInput.ageRangeIds,
            maps.inputAgeRanges
        )
        errors.push(...ageRangeErrors)

        // Do any of the inputted age range IDs not exist in the class, thus making it nonsensical to delete them from the class?
        const classAgeRanges = maps.existingClassAgeRanges.get(classId)
        if (classAgeRanges) {
            const ageRangeChildErrors = flagNonExistentChild(
                Class,
                AgeRange,
                index,
                classId,
                ageRangeIds,
                new Set(classAgeRanges.map((ageRange) => ageRange.id))
            )
            if (ageRangeChildErrors.length) errors.push(...ageRangeChildErrors)
        }

        return errors
    }

    process(
        currentInput: RemoveAgeRangesFromClassInput,
        maps: EntityMapAddRemoveAgeRanges,
        index: number
    ) {
        const { classId, ageRangeIds } = currentInput
        const ageRangeIdsSet = new Set(ageRangeIds)
        const preExistentAgeRanges = maps.existingClassAgeRanges.get(classId)!
        const keptAgeRanges = preExistentAgeRanges.filter(
            (ageRange) => !ageRangeIdsSet.has(ageRange.id)
        )

        const currentClass = maps.mainEntity.get(this.mainEntityIds[index])!
        currentClass.age_ranges = Promise.resolve(keptAgeRanges)

        return { outputEntity: currentClass }
    }

    protected async buildOutput(currentClass: Class): Promise<void> {
        this.output.classes.push(mapClassToClassConnectionNode(currentClass))
    }
}

export async function generateMapsForAddingRemovingAgeRanges(
    mainEntityIds: string[],
    input: RemoveAgeRangesFromClassInput[]
): Promise<EntityMapAddRemoveAgeRanges> {
    const classes = await getMap.class(mainEntityIds, ['age_ranges'])

    const ageRanges = await getMap.ageRange(input.flatMap((i) => i.ageRangeIds))

    const inputAgeRangeOrgsMap = new Map<string, string>()
    for (const ageRange of ageRanges.values()) {
        const ageRangeOrgId = ageRange.organization_id
        if (ageRangeOrgId) {
            inputAgeRangeOrgsMap.set(ageRange.id, ageRangeOrgId)
        }
    }

    const existingClassAgeRangesMap = new Map<string, AgeRange[]>()
    for (const class_ of classes.values()) {
        existingClassAgeRangesMap.set(
            class_.class_id,
            // eslint-disable-next-line no-await-in-loop
            (await class_.age_ranges) || []
        )
    }

    return {
        mainEntity: classes,
        inputAgeRanges: ageRanges,
        inputAgeRangeOrgs: inputAgeRangeOrgsMap,
        existingClassAgeRanges: existingClassAgeRangesMap,
    }
}

export interface RemoveSubjectsClassesEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    subjects: Map<string, Subject>
    classesSubjects: Map<string, Subject[]>
    schoolIds: string[]
}

export class RemoveSubjectsFromClasses extends RemoveMutation<
    Class,
    RemoveSubjectsFromClassInput,
    ClassesMutationResult,
    RemoveSubjectsClassesEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'RemoveSubjectsFromClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: RemoveSubjectsFromClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: RemoveSubjectsFromClassInput[]
    ): Promise<RemoveSubjectsClassesEntityMap> => {
        const classIds = input.map((i) => i.classId)
        const classMap = await getMap.class(classIds, ['subjects', 'schools'])
        const subjectIds = input.flatMap((i) => i.subjectIds)
        const subjectMap = getMap.subject(subjectIds)

        const classesSubjects = new Map<string, Subject[]>()
        const schoolIds: Set<string> = new Set()
        for (const class_ of classMap.values()) {
            // eslint-disable-next-line no-await-in-loop
            const schools = (await class_.schools) ?? []
            for (const school of schools) {
                schoolIds.add(school.school_id)
            }
            // eslint-disable-next-line no-await-in-loop
            const subjects = (await class_.subjects) || []
            classesSubjects.set(class_.class_id, subjects)
        }

        return {
            mainEntity: classMap,
            subjects: await subjectMap,
            classesSubjects,
            schoolIds: Array.from(schoolIds),
        }
    }

    async authorize(
        _input: RemoveSubjectsFromClassInput[],
        maps: RemoveSubjectsClassesEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((c) => c.organization_id)
        )
        const permissionContext = {
            organization_ids: organizationIds,
            school_ids: maps.schoolIds,
        }
        return this.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: RemoveSubjectsFromClassInput[]
    ): {
        validInputs: { index: number; input: RemoveSubjectsFromClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            ['classId']
        )

        const subjectIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subjectIds'
        )

        return filterInvalidInputs(inputs, [
            classIdErrorMap,
            ...subjectIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        currentEntity: Class,
        currentInput: RemoveSubjectsFromClassInput,
        maps: RemoveSubjectsClassesEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, subjectIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const subjects = flagNonExistent(
            Subject,
            index,
            subjectIds,
            maps.subjects
        )
        errors.push(...subjects.errors)

        const currentClassSubjects = new Map(
            maps.classesSubjects.get(classId)?.map((s) => [s.id, s])
        )

        const subjectInClassErrors = flagNonExistentChild(
            Class,
            Subject,
            index,
            classId,
            subjectIds,
            new Set(
                Array.from(currentClassSubjects.values()).map(
                    (subject) => subject.id
                )
            )
        )

        errors.push(...subjectInClassErrors)

        return errors
    }

    process(
        currentInput: RemoveSubjectsFromClassInput,
        maps: RemoveSubjectsClassesEntityMap,
        index: number
    ) {
        const { classId, subjectIds } = currentInput
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const subjectIdsToRemove = new Set(subjectIds)
        const preExistentSubjects = maps.classesSubjects.get(classId)!

        const keptSubjects = preExistentSubjects.filter(
            (subject) => !subjectIdsToRemove.has(subject.id)
        )
        currentEntity.subjects = Promise.resolve(keptSubjects)
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export interface AddSubjectsClassesEntityMap extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    subjects: Map<string, Subject>
    classesSubjects: Map<string, Subject[]>
    subjectsOrgs: Map<string, string>
}

export class AddSubjectsToClasses extends AddMutation<
    Class,
    AddSubjectsToClassInput,
    ClassesMutationResult,
    AddSubjectsClassesEntityMap
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'AddSubjectsToClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: AddSubjectsToClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: AddSubjectsToClassInput[]
    ): Promise<AddSubjectsClassesEntityMap> => {
        const classMap = await getMap.class(this.mainEntityIds, ['subjects'])
        const subjectIds = input.flatMap((i) => i.subjectIds)
        const subjectsMap = await getMap.subject(subjectIds)
        const subjectsOrgs = new Map<string, string>()
        for (const subject of subjectsMap.values()) {
            const subjectOrgId = subject.organization_id
            if (subjectOrgId) {
                subjectsOrgs.set(subject.id, subjectOrgId)
            }
        }

        const classesSubjects = new Map<string, Subject[]>()
        for (const class_ of classMap.values()) {
            // eslint-disable-next-line no-await-in-loop
            const subjects = (await class_.subjects) || []
            classesSubjects.set(class_.class_id, subjects)
        }

        return {
            mainEntity: classMap,
            subjects: subjectsMap,
            classesSubjects,
            subjectsOrgs,
        }
    }

    async authorize(
        _input: AddSubjectsToClassInput[],
        maps: AddSubjectsClassesEntityMap
    ): Promise<void> {
        const organizationIds = uniqueAndTruthy(
            Array.from(maps.mainEntity.values()).map((c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: AddSubjectsToClassInput[],
        entityMaps: AddSubjectsClassesEntityMap
    ): {
        validInputs: { index: number; input: AddSubjectsToClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            inputs.map((cls) => cls.classId),
            this.EntityType.name,
            this.inputTypeName,
            'classId'
        )

        const subjectIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subjectIds'
        )

        return filterInvalidInputs(inputs, [
            ...classIdErrorMap,
            ...subjectIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        currentEntity: Class,
        currentInput: AddSubjectsToClassInput,
        maps: AddSubjectsClassesEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, subjectIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const subjects = flagNonExistent(
            Subject,
            index,
            subjectIds,
            maps.subjects
        )
        errors.push(...subjects.errors)

        const currentClassSubjects = new Set(
            maps.classesSubjects.get(classId)?.map((s) => s.id)
        )

        const alreadyAddedErrors = flagExistentChild(
            Class,
            Subject,
            index,
            classId,
            subjectIds,
            currentClassSubjects
        )

        errors.push(...alreadyAddedErrors)

        const classOrgId = maps.mainEntity.get(classId)?.organization_id
        if (classOrgId) {
            for (const inputSubjectId of subjectIds) {
                const subjectOrgId = maps.subjectsOrgs.get(inputSubjectId)
                if (subjectOrgId && subjectOrgId !== classOrgId) {
                    errors.push(
                        createEntityAPIError(
                            'nonExistentChild',
                            index,
                            Subject.name,
                            inputSubjectId,
                            Organization.name,
                            classOrgId
                        )
                    )
                }
            }
        }

        return errors
    }

    process(
        currentInput: AddSubjectsToClassInput,
        maps: AddSubjectsClassesEntityMap,
        index: number
    ) {
        const { classId, subjectIds } = currentInput

        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        const subjectsToAdd: Subject[] = []
        for (const subjectId of subjectIds) {
            const subjectToAdd = maps.subjects.get(subjectId)!
            subjectsToAdd.push(subjectToAdd)
        }
        const preExistentSubjects = maps.classesSubjects.get(classId)!
        currentEntity.subjects = Promise.resolve([
            ...preExistentSubjects,
            ...subjectsToAdd,
        ])
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export interface EntityMapAddRemoveGrades extends EntityMap<Class> {
    mainEntity: Map<string, Class>
    grades: Map<string, Grade>
    classesGrades: Map<string, Grade[]>
}

export const generateMapsForAddingRemovingGrades = async (
    input: RemoveGradesFromClassInput[]
): Promise<EntityMapAddRemoveGrades> => {
    const gradeIds = input.flatMap((i) => i.gradeIds)
    const gradesMap = getMap.grade(gradeIds, ['organization'])
    const classIds = input.map((i) => i.classId)
    const classMap = await getMap.class(classIds, ['organization', 'grades'])

    const classesGrades = new Map<string, Grade[]>()
    for (const class_ of classMap.values()) {
        // eslint-disable-next-line no-await-in-loop
        const grades = (await class_.grades) || []
        classesGrades.set(class_.class_id, grades)
    }

    return {
        mainEntity: classMap,
        grades: await gradesMap,
        classesGrades,
    }
}

export class AddGradesToClasses extends AddMutation<
    Class,
    AddGradesToClassInput,
    ClassesMutationResult,
    EntityMapAddRemoveGrades
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'AddGradesToClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: AddGradesToClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps = async (
        input: RemoveGradesFromClassInput[]
    ): Promise<EntityMapAddRemoveGrades> =>
        generateMapsForAddingRemovingGrades(input)

    async authorize(
        _input: AddGradesToClassInput[],
        maps: EntityMapAddRemoveGrades
    ): Promise<void> {
        const organization_ids = uniqueAndTruthy(
            Array.from(maps.mainEntity.values(), (c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: AddGradesToClassInput[]
    ): {
        validInputs: { index: number; input: AddGradesToClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            ['classId']
        )

        const gradeIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'gradeIds'
        )

        return filterInvalidInputs(inputs, [
            classIdErrorMap,
            ...gradeIdsErrorMap,
        ])
    }

    validate(
        index: number,
        currentEntity: Class,
        currentInput: AddGradesToClassInput,
        maps: EntityMapAddRemoveGrades
    ): APIError[] {
        const errors: APIError[] = []
        const { classId, gradeIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const currentClassGrades = new Set(
            maps.classesGrades.get(classId)?.map((s) => s.id)
        )

        const grades = flagNonExistent(Grade, index, gradeIds, maps.grades)
        errors.push(...grades.errors)

        // Checking that these grades also exists for the same organization or are system
        errors.push(
            ...validateSubItemsInOrg(
                Grade,
                grades.values.map((g) => g.id),
                index,
                maps.grades,
                currentEntity?.organization_id
            )
        )

        const alreadyAddedErrors = flagExistentChild(
            Class,
            Grade,
            index,
            classId,
            gradeIds,
            currentClassGrades
        )

        errors.push(...alreadyAddedErrors)

        return errors
    }

    process(
        currentInput: AddGradesToClassInput,
        maps: EntityMapAddRemoveGrades,
        index: number
    ) {
        const { classId, gradeIds } = currentInput
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const gradesToAdd: Grade[] = []
        for (const gradeId of gradeIds) {
            const gradeToAdd = maps.grades.get(gradeId)!
            gradesToAdd.push(gradeToAdd)
        }
        const preExistentGrades = maps.classesGrades.get(classId)!
        currentEntity.grades = Promise.resolve([
            ...preExistentGrades,
            ...gradesToAdd,
        ])
        return { outputEntity: currentEntity }
    }

    protected buildOutput = async (currentEntity: Class): Promise<void> => {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}

export class RemoveGradesFromClasses extends RemoveMutation<
    Class,
    RemoveGradesFromClassInput,
    ClassesMutationResult,
    EntityMapAddRemoveGrades
> {
    protected readonly EntityType = Class
    protected inputTypeName = 'RemoveGradesFromClassInput'
    protected mainEntityIds: string[]
    protected output: ClassesMutationResult = { classes: [] }

    constructor(
        input: RemoveGradesFromClassInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.classId)
    }

    generateEntityMaps(
        input: RemoveGradesFromClassInput[]
    ): Promise<EntityMapAddRemoveGrades> {
        return generateMapsForAddingRemovingGrades(input)
    }

    async authorize(
        _input: RemoveGradesFromClassInput[],
        maps: EntityMapAddRemoveGrades
    ): Promise<void> {
        const organization_ids = uniqueAndTruthy(
            Array.from(maps.mainEntity.values(), (c) => c.organization_id)
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids },
            PermissionName.edit_class_20334
        )
    }

    validationOverAllInputs(
        inputs: RemoveGradesFromClassInput[]
    ): {
        validInputs: { index: number; input: RemoveGradesFromClassInput }[]
        apiErrors: APIError[]
    } {
        const classIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.classId),
            this.inputTypeName,
            ['classId']
        )

        const gradeIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'gradeIds'
        )

        return filterInvalidInputs(inputs, [
            classIdErrorMap,
            ...gradeIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        currentEntity: Class,
        currentInput: RemoveGradesFromClassInput,
        maps: EntityMapAddRemoveGrades
    ): APIError[] => {
        const errors: APIError[] = []
        const { classId, gradeIds } = currentInput

        const classes = flagNonExistent(
            Class,
            index,
            [classId],
            maps.mainEntity
        )
        errors.push(...classes.errors)

        const currentClassGrades = new Set(
            maps.classesGrades.get(classId)?.map((s) => s.id)
        )

        const grades = flagNonExistent(Grade, index, gradeIds, maps.grades)
        errors.push(...grades.errors)

        const gradeChildErrors = flagNonExistentChild(
            Class,
            Grade,
            index,
            classId,
            gradeIds,
            currentClassGrades
        )

        errors.push(...gradeChildErrors)

        return errors
    }

    process(
        currentInput: RemoveGradesFromClassInput,
        maps: EntityMapAddRemoveGrades,
        index: number
    ) {
        const { classId, gradeIds } = currentInput
        const gradeIdsSet = new Set(gradeIds)
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const preExistentGrades = maps.classesGrades.get(classId)!
        const keptGrades = preExistentGrades.filter(
            (grade) => !gradeIdsSet.has(grade.id)
        )

        currentEntity.grades = Promise.resolve(keptGrades)

        return { outputEntity: currentEntity }
    }

    protected async buildOutput(currentEntity: Class): Promise<void> {
        this.output.classes.push(mapClassToClassConnectionNode(currentEntity))
    }
}
