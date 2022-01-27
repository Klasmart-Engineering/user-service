import { In } from 'typeorm'
import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Organization } from '../entities/organization'
import { Program } from '../entities/program'
import { Status } from '../entities/status'
import { Subject } from '../entities/subject'
import { mapProgramToProgramConnectionNode } from '../pagination/programsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateProgramInput,
    ProgramsMutationResult,
} from '../types/graphQL/program'
import {
    ConflictingNameKey,
    CreateMutation,
    EntityMap,
    filterInvalidInputs,
    validateNoDuplicate,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { getMap } from '../utils/resolvers/entityMaps'
import { createExistentEntityAttributeAPIError } from '../utils/resolvers/errors'
import {
    flagNonExistent,
    validateSubItemsInOrg,
} from '../utils/resolvers/inputValidation'
import { ObjMap } from '../utils/stringUtils'

export interface CreateProgramsEntityMap extends EntityMap<Program> {
    organizations: Map<string, Organization>
    ageRanges: Map<string, AgeRange>
    grades: Map<string, Grade>
    subjects: Map<string, Subject>
    conflictingNames: ObjMap<ConflictingNameKey, Program>
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
                AgeRange,
                index,
                organizationId,
                maps.ageRanges
            )
        )

        errors.push(
            ...flagNonExistent(Grade, index, gradeIds, maps.grades).errors
        )

        errors.push(
            ...validateSubItemsInOrg(Grade, index, organizationId, maps.grades)
        )

        errors.push(
            ...flagNonExistent(Subject, index, subjectIds, maps.subjects).errors
        )

        errors.push(
            ...validateSubItemsInOrg(
                Subject,
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
