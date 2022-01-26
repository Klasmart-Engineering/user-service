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
    ProgramsMutationOutput,
    UpdateProgramInput,
} from '../types/graphQL/program'
import {
    ConflictingNameKey,
    CreateMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    UpdateMutation,
    validateAtLeastOne,
    validateNoDuplicate,
    validateNoDuplicateAttribute,
    validateSubItemsInOrg,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { getMap } from '../utils/resolvers/entityMaps'
import { createExistentEntityAttributeAPIError } from '../utils/resolvers/errors'
import { flagNonExistent } from '../utils/resolvers/inputValidation'
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
}

export class CreatePrograms extends CreateMutation<
    Program,
    CreateProgramInput,
    ProgramsMutationOutput,
    CreateProgramsEntityMap
> {
    protected readonly EntityType = Program
    protected inputTypeName = 'CreateProgramInput'
    protected output: ProgramsMutationOutput = { programs: [] }

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

        const conflictingNames = new ObjMap<ConflictingNameKey, Program>()
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

        errors.push(
            ...flagNonExistent(AgeRange, index, ageRangeIds, maps.ageRanges)
                .errors
        )

        errors.push(
            ...validateSubItemsInOrg(
                'AgeRange',
                index,
                organizationId,
                maps.ageRanges
            )
        )

        errors.push(
            ...flagNonExistent(Grade, index, gradeIds, maps.grades).errors
        )

        errors.push(
            ...validateSubItemsInOrg(
                'Grade',
                index,
                organizationId,
                maps.grades
            )
        )

        errors.push(
            ...flagNonExistent(Subject, index, subjectIds, maps.subjects).errors
        )

        errors.push(
            ...validateSubItemsInOrg(
                'Subject',
                index,
                organizationId,
                maps.subjects
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
    ProgramsMutationOutput,
    UpdateProgramsEntityMap
> {
    protected readonly EntityType = Program
    protected inputTypeName = 'UpdateProgramInput'
    protected mainEntityIds: string[] = []
    protected output: ProgramsMutationOutput = { programs: [] }

    constructor(
        input: UpdateProgramInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        for (const val of input) {
            this.mainEntityIds.push(val.id)
        }
    }

    protected async generateEntityMaps(
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

        const conflictingNames = new ObjMap<ConflictingNameKey, Program>()

        for (const p of preloadedMatchingNames) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await p.organization)?.organization_id
            const programName = p.name!
            conflictingNames.set({ organizationId, name: programName }, p)
        }

        return {
            mainEntity: await preloadedPrograms,
            ageRanges: await preloadedAgeRanges,
            grades: await preloadedGrades,
            subjects: await preloadedSubjects,
            conflictingNames,
        }
    }

    async authorize(
        _input: UpdateProgramInput[],
        maps: UpdateProgramsEntityMap
    ): Promise<void> {
        const organizationIds: string[] = []
        const programs = [...maps.mainEntity.values()]

        for (const p of programs) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await p.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
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
            'id'
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
        const programMap = maps.mainEntity
        const ageRangeMap = maps.ageRanges
        const gradeMap = maps.grades
        const subjectMap = maps.subjects
        const conflictNamesMap = maps.conflictingNames

        // Checking that the program exist
        const programExists = flagNonExistent(Program, index, [id], programMap)
        errors.push(...programExists.errors)

        if (!programExists.values.length) return errors

        const organizationId = (program as ProgramAndOrg).__organization__
            ?.organization_id

        if (name) {
            // Checking that there is not another program in the same organization with the given name
            const conflictingNameProgramId = conflictNamesMap.get({
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
            errors.push(
                ...flagNonExistent(AgeRange, index, ageRangeIds, ageRangeMap)
                    .errors
            )

            // Checking that these age ranges also exists for the same organization or are system
            errors.push(
                ...validateSubItemsInOrg(
                    'AgeRange',
                    index,
                    organizationId,
                    ageRangeMap
                )
            )
        }

        if (gradeIds) {
            // Checking that the grades already exist
            errors.push(
                ...flagNonExistent(Grade, index, gradeIds, gradeMap).errors
            )

            // Checking that these grades also exists for the same organization or are system
            errors.push(
                ...validateSubItemsInOrg(
                    'Grade',
                    index,
                    organizationId,
                    gradeMap
                )
            )
        }

        if (subjectIds) {
            // Checking that the subjects already exist
            errors.push(
                ...flagNonExistent(Subject, index, subjectIds, subjectMap)
                    .errors
            )

            // Checking that these subjects also exists for the same organization or are system
            errors.push(
                ...validateSubItemsInOrg(
                    'Subject',
                    index,
                    organizationId,
                    subjectMap
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
        const programConnectionNode = await mapProgramToProgramConnectionNode(
            outputProgram
        )

        this.output.programs.push(programConnectionNode)
    }
}
