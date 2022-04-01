import { In } from 'typeorm'
import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Organization } from '../entities/organization'
import { Program } from '../entities/program'
import { Status } from '../entities/status'
import { Subject } from '../entities/subject'
import { Context } from '../main'
import { mapProgramToProgramConnectionNode } from '../pagination/programsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateProgramInput,
    UpdateProgramInput,
    ProgramsMutationResult,
    DeleteProgramInput,
} from '../types/graphQL/program'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    UpdateMutation,
    validateAtLeastOne,
    validateNoDuplicate,
    validateNoDuplicateAttribute,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { ConflictingNameKey, getMap } from '../utils/resolvers/entityMaps'
import { createExistentEntityAttributeAPIError } from '../utils/resolvers/errors'
import {
    flagNonExistent,
    validateSubItemsInOrg,
} from '../utils/resolvers/inputValidation'
import { ObjMap } from '../utils/stringUtils'

export type ProgramAndOrg = Program & { __organization__?: Organization }
export interface CreateProgramsEntityMap extends EntityMap<Program> {
    organizations: Map<string, Organization>
    ageRanges: Map<string, AgeRange>
    grades: Map<string, Grade>
    subjects: Map<string, Subject>
    conflictingNames: ObjMap<ConflictingNameKey, Program>
}

export interface UpdateProgramsEntityMap extends EntityMap<Program> {
    mainEntity: Map<string, Program>
    ageRanges: Map<string, AgeRange>
    grades: Map<string, Grade>
    subjects: Map<string, Subject>
    conflictingNames: ObjMap<ConflictingNameKey, Program>
    organizationIds: string[]
}

export interface DeleteProgramsEntityMap extends EntityMap<Program> {
    mainEntity: Map<string, Program>
    organizationIds: string[]
}

export class CreatePrograms extends CreateMutation<
    Program,
    CreateProgramInput,
    ProgramsMutationResult,
    CreateProgramsEntityMap
> {
    protected readonly EntityType = Program
    protected inputTypeName = 'CreateProgramInput'
    protected output: ProgramsMutationResult = { programs: [] }

    async generateEntityMaps(
        input: CreateProgramInput[]
    ): Promise<CreateProgramsEntityMap> {
        const organizationIds: string[] = []
        const names: string[] = []
        const allAgeRangeIds: string[] = []
        const allGradeIds: string[] = []
        const allSubjectIds: string[] = []

        input.forEach((i) => {
            organizationIds.push(i.organizationId)
            names.push(i.name)
            allAgeRangeIds.push(...i.ageRangeIds)
            allGradeIds.push(...i.gradeIds)
            allSubjectIds.push(...i.subjectIds)
        })

        const ageRangeIds = Array.from(new Set(allAgeRangeIds))
        const gradeIds = Array.from(new Set(allGradeIds))
        const subjectIds = Array.from(new Set(allSubjectIds))

        const organizations = await getMap.organization(organizationIds)
        const ageRanges = await getMap.ageRange(ageRangeIds, ['organization'])
        const grades = await getMap.grade(gradeIds, ['organization'])
        const subjects = await getMap.subject(subjectIds, ['organization'])

        const matchingPreloadedProgramArray = await Program.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
                organization: In(organizationIds),
            },
            relations: ['organization'],
        })

        const conflictingNames = new ObjMap<ConflictingNameKey, Program>()
        for (const p of matchingPreloadedProgramArray) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await p.organization)!.organization_id
            const name = p.name!
            conflictingNames.set({ organizationId, name }, p)
        }

        return {
            organizations,
            ageRanges,
            grades,
            subjects,
            conflictingNames,
        }
    }

    authorize(input: CreateProgramInput[]): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: input.map((i) => i.organizationId) },
            PermissionName.create_program_20221
        )
    }

    validationOverAllInputs(
        inputs: CreateProgramInput[]
    ): {
        validInputs: { index: number; input: CreateProgramInput }[]
        apiErrors: APIError[]
    } {
        // Checking duplicates in organizationId and name combination
        const failedDuplicateNames = validateNoDuplicate(
            inputs.map((i) => [i.organizationId, i.name].toString()),
            'program',
            ['name']
        )

        // Checking duplicates and length in ageRangeIds
        const failedAgeRanges = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'ageRangeIds'
        )

        // Checking duplicates and length in gradeIds
        const failedGrades = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'gradeIds'
        )

        // Checking duplicates and length in subjectIds
        const failedSubjects = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subjectIds'
        )

        return filterInvalidInputs(inputs, [
            failedDuplicateNames,
            ...failedAgeRanges,
            ...failedGrades,
            ...failedSubjects,
        ])
    }

    validate(
        index: number,
        _program: undefined,
        currentInput: CreateProgramInput,
        maps: CreateProgramsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const {
            organizationId,
            name,
            ageRangeIds,
            gradeIds,
            subjectIds,
        } = currentInput

        const organization = flagNonExistent(
            Organization,
            index,
            [organizationId],
            maps.organizations
        )

        errors.push(...organization.errors)

        const conflictingNameProgramId = maps.conflictingNames.get({
            organizationId,
            name,
        })?.id

        if (conflictingNameProgramId) {
            errors.push(
                createExistentEntityAttributeAPIError(
                    'Program',
                    conflictingNameProgramId,
                    'name',
                    name,
                    index
                )
            )
        }

        const ageRanges = flagNonExistent(
            AgeRange,
            index,
            ageRangeIds,
            maps.ageRanges
        )

        errors.push(...ageRanges.errors)
        errors.push(
            ...validateSubItemsInOrg(
                AgeRange,
                ageRanges.values.map((ar) => ar.id),
                index,
                maps.ageRanges,
                organizationId
            )
        )

        const grades = flagNonExistent(Grade, index, gradeIds, maps.grades)
        errors.push(...grades.errors)
        errors.push(
            ...validateSubItemsInOrg(
                Grade,
                grades.values.map((g) => g.id),
                index,
                maps.grades,
                organizationId
            )
        )

        const subjects = flagNonExistent(
            Subject,
            index,
            subjectIds,
            maps.subjects
        )

        errors.push(...subjects.errors)
        errors.push(
            ...validateSubItemsInOrg(
                Subject,
                subjects.values.map((s) => s.id),
                index,
                maps.subjects,
                organizationId
            )
        )

        return errors
    }

    protected process(
        currentInput: CreateProgramInput,
        maps: CreateProgramsEntityMap
    ) {
        const {
            organizationId,
            name,
            ageRangeIds,
            gradeIds,
            subjectIds,
        } = currentInput

        const program = new Program()
        program.name = name
        program.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        const programAgeRanges = Array.from(
            ageRangeIds,
            (ageRangeId) => maps.ageRanges.get(ageRangeId)!
        )
        program.age_ranges = Promise.resolve(programAgeRanges)

        const programGrades = Array.from(
            gradeIds,
            (gradeId) => maps.grades.get(gradeId)!
        )
        program.grades = Promise.resolve(programGrades)

        const programSubjects = Array.from(
            subjectIds,
            (subjectId) => maps.subjects.get(subjectId)!
        )
        program.subjects = Promise.resolve(programSubjects)

        return { outputEntity: program }
    }

    protected async buildOutput(outputProgram: Program): Promise<void> {
        const programConnectionNode = mapProgramToProgramConnectionNode(
            outputProgram
        )

        this.output.programs.push(programConnectionNode)
    }
}

export class UpdatePrograms extends UpdateMutation<
    Program,
    UpdateProgramInput,
    ProgramsMutationResult,
    UpdateProgramsEntityMap
> {
    protected readonly EntityType = Program
    protected inputTypeName = 'UpdateProgramInput'
    protected mainEntityIds: string[] = []
    protected output: ProgramsMutationResult = { programs: [] }

    constructor(
        input: UpdateProgramInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        for (const val of input) {
            this.mainEntityIds.push(val.id)
        }
    }

    async generateEntityMaps(
        input: UpdateProgramInput[]
    ): Promise<UpdateProgramsEntityMap> {
        const ids: string[] = []
        const names: string[] = []
        const ageRangeIds: string[] = []
        const gradeIds: string[] = []
        const subjectIds: string[] = []

        input.forEach((i) => {
            ids.push(i.id)
            if (i.name) names.push(i.name)
            if (i.ageRangeIds) ageRangeIds.push(...i.ageRangeIds)
            if (i.gradeIds) gradeIds.push(...i.gradeIds)
            if (i.subjectIds) subjectIds.push(...i.subjectIds)
        })

        const preloadedPrograms = getMap.program(ids, ['organization'])
        const preloadedAgeRanges = getMap.ageRange(ageRangeIds, [
            'organization',
        ])
        const preloadedGrades = getMap.grade(gradeIds, ['organization'])
        const preloadedSubjects = getMap.subject(subjectIds, ['organization'])
        const preloadedMatchingNames = await Program.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        const mainEntity = await preloadedPrograms
        const allOrgIds = (
            await Promise.all(
                Array.from(mainEntity.values()).map(
                    async (p) => (await p.organization)?.organization_id
                )
            )
        ).filter((id) => id) as string[]

        const organizationIds = Array.from(new Set(allOrgIds))
        const conflictingNames = new ObjMap<ConflictingNameKey, Program>()
        for (const p of preloadedMatchingNames) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await p.organization)?.organization_id
            const programName = p.name!
            conflictingNames.set({ organizationId, name: programName }, p)
        }

        return {
            mainEntity,
            ageRanges: await preloadedAgeRanges,
            grades: await preloadedGrades,
            subjects: await preloadedSubjects,
            conflictingNames,
            organizationIds,
        }
    }

    async authorize(
        _input: UpdateProgramInput[],
        maps: UpdateProgramsEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.edit_program_20331
        )
    }

    validationOverAllInputs(
        inputs: UpdateProgramInput[],
        maps: UpdateProgramsEntityMap
    ): {
        validInputs: { index: number; input: UpdateProgramInput }[]
        apiErrors: APIError[]
    } {
        // Checking that at least one of the optional params is sent
        const failedAtLeastOne = validateAtLeastOne(inputs, 'Program', [
            'name',
            'ageRangeIds',
            'gradeIds',
            'subjectIds',
        ])

        // Checking that you are not editing the same program more than once
        const failedDuplicates = validateNoDuplicate(
            inputs.map((i) => i.id),
            'program',
            ['id']
        )

        const values = []
        for (const { id, name } of inputs) {
            const program = maps.mainEntity.get(id) as ProgramAndOrg
            let organizationId = undefined

            if (program) {
                organizationId = program.__organization__?.organization_id || ''
            }

            values.push({ entityId: organizationId, attributeValue: name })
        }

        // Checking that the names in the inputs are not duplicated for programs in the same organization
        const failedDuplicateInOrg = validateNoDuplicateAttribute(
            values,
            'Program',
            'name'
        )

        // Checking duplicates and length in ageRangeIds
        const failedAgeRanges = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'ageRangeIds'
        )

        // Checking duplicates and length in gradeIds
        const failedGrades = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'gradeIds'
        )

        // Checking duplicates and length in subjectIds
        const failedSubjects = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subjectIds'
        )

        return filterInvalidInputs(inputs, [
            failedAtLeastOne,
            failedDuplicates,
            failedDuplicateInOrg,
            ...failedAgeRanges,
            ...failedGrades,
            ...failedSubjects,
        ])
    }

    validate(
        index: number,
        program: Program,
        currentInput: UpdateProgramInput,
        maps: UpdateProgramsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { id, name, ageRangeIds, gradeIds, subjectIds } = currentInput

        // Checking that the program exist
        const programExists = flagNonExistent(
            Program,
            index,
            [id],
            maps.mainEntity
        )
        errors.push(...programExists.errors)

        if (!programExists.values.length) return errors

        const organizationId = (program as ProgramAndOrg).__organization__
            ?.organization_id

        if (name) {
            // Checking that there is not another program in the same organization with the given name
            const conflictingNameProgramId = maps.conflictingNames.get({
                organizationId,
                name,
            })?.id

            if (conflictingNameProgramId) {
                errors.push(
                    createExistentEntityAttributeAPIError(
                        'Program',
                        conflictingNameProgramId,
                        'name',
                        name,
                        index
                    )
                )
            }
        }

        if (ageRangeIds) {
            // Checking that the age ranges already exist
            const ageRanges = flagNonExistent(
                AgeRange,
                index,
                ageRangeIds,
                maps.ageRanges
            )

            errors.push(...ageRanges.errors)

            // Checking that these age ranges also exists for the same organization or are system
            errors.push(
                ...validateSubItemsInOrg(
                    AgeRange,
                    ageRanges.values.map((ar) => ar.id),
                    index,
                    maps.ageRanges,
                    organizationId
                )
            )
        }

        if (gradeIds) {
            // Checking that the grades already exist
            const grades = flagNonExistent(Grade, index, gradeIds, maps.grades)
            errors.push(...grades.errors)

            // Checking that these grades also exists for the same organization or are system
            errors.push(
                ...validateSubItemsInOrg(
                    Grade,
                    grades.values.map((g) => g.id),
                    index,
                    maps.grades,
                    organizationId
                )
            )
        }

        if (subjectIds) {
            // Checking that the subjects already exist
            const subjects = flagNonExistent(
                Subject,
                index,
                subjectIds,
                maps.subjects
            )

            errors.push(...subjects.errors)

            // Checking that these subjects also exists for the same organization or are system
            errors.push(
                ...validateSubItemsInOrg(
                    Subject,
                    subjects.values.map((s) => s.id),
                    index,
                    maps.subjects,
                    organizationId
                )
            )
        }

        return errors
    }

    protected process(
        currentInput: UpdateProgramInput,
        maps: UpdateProgramsEntityMap
    ): ProcessedResult<Program, Program> {
        const { id, name, ageRangeIds, gradeIds, subjectIds } = currentInput
        const program = maps.mainEntity.get(id)!

        program.name = name || program.name

        if (ageRangeIds) {
            program.age_ranges = Promise.resolve(
                Array.from(ageRangeIds, (arid) => maps.ageRanges.get(arid)!)
            )
        }

        if (gradeIds) {
            program.grades = Promise.resolve(
                Array.from(gradeIds, (gid) => maps.grades.get(gid)!)
            )
        }

        if (subjectIds) {
            program.subjects = Promise.resolve(
                Array.from(subjectIds, (sid) => maps.subjects.get(sid)!)
            )
        }

        return { outputEntity: program }
    }

    protected async buildOutput(outputProgram: Program): Promise<void> {
        const programConnectionNode = mapProgramToProgramConnectionNode(
            outputProgram
        )

        this.output.programs.push(programConnectionNode)
    }
}

export class DeletePrograms extends DeleteMutation<
    Program,
    DeleteProgramInput,
    ProgramsMutationResult
> {
    protected readonly EntityType = Program
    protected readonly inputTypeName = 'DeleteProgramInput'
    protected readonly output: ProgramsMutationResult = { programs: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteProgramInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: DeleteProgramInput[]
    ): Promise<DeleteProgramsEntityMap> {
        const programs = await getMap.program(
            input.map((i) => i.id),
            ['organization']
        )

        const allOrgIds = (
            await Promise.all(
                Array.from(programs.values()).map(
                    async (p) => (await p.organization)?.organization_id
                )
            )
        ).filter((id) => id) as string[]
        const organizationIds = Array.from(new Set(allOrgIds))

        return { mainEntity: programs, organizationIds }
    }

    async authorize(
        _input: DeleteProgramInput[],
        maps: DeleteProgramsEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.delete_program_20441
        )
    }

    protected async buildOutput(program: Program): Promise<void> {
        this.output.programs.push(mapProgramToProgramConnectionNode(program))
    }
}
