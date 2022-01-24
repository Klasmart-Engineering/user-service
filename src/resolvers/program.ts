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
import {
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
} from '../utils/resolvers/errors'
import {
    Entities,
    flagNonExistent,
    SystemEntities,
} from '../utils/resolvers/inputValidation'
import { ObjMap } from '../utils/stringUtils'

export type SystemEntityAndOrg = SystemEntities & {
    __organization__?: Organization
}

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
    ProgramsMutationOutput,
    CreateProgramsEntityMap
> {
    protected readonly EntityType = Program
    protected inputTypeName = 'CreateProgramInput'
    protected output: ProgramsMutationOutput = { programs: [] }

    constructor(
        input: CreateProgramInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
    }

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
            if (i.ageRangeIds) allAgeRangeIds.push(...i.ageRangeIds)
            if (i.gradeIds) allGradeIds.push(...i.gradeIds)
            if (i.subjectIds) allSubjectIds.push(...i.subjectIds)
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

        const organizationMap = maps.organizations
        const ageRangeMap = maps.ageRanges
        const gradeMap = maps.grades
        const subjectMap = maps.subjects
        const conflictNamesMap = maps.conflictingNames

        const organization = flagNonExistent(
            Organization,
            index,
            [organizationId],
            organizationMap
        )

        errors.push(...organization.errors)

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

        if (ageRangeIds) {
            errors.push(
                ...validateSubItemsExistence(
                    AgeRange,
                    index,
                    ageRangeIds,
                    ageRangeMap
                )
            )

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
            errors.push(
                ...validateSubItemsExistence(Grade, index, gradeIds, gradeMap)
            )

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
            errors.push(
                ...validateSubItemsExistence(
                    Subject,
                    index,
                    subjectIds,
                    subjectMap
                )
            )

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

        if (ageRangeIds) {
            const programAgeRanges = Array.from(
                ageRangeIds,
                (ageRangeId) => maps.ageRanges.get(ageRangeId)!
            )

            program.age_ranges = Promise.resolve(programAgeRanges)
        }

        if (gradeIds) {
            const programGrades = Array.from(
                gradeIds,
                (gradeId) => maps.grades.get(gradeId)!
            )

            program.grades = Promise.resolve(programGrades)
        }

        if (subjectIds) {
            const programSubjects = Array.from(
                subjectIds,
                (subjectId) => maps.subjects.get(subjectId)!
            )

            program.subjects = Promise.resolve(programSubjects)
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

function validateSubItemsExistence<Entity extends Entities>(
    entity: new () => Entities,
    index: number,
    subItemIds: string[],
    subItemMap: Map<string, Entity>
) {
    return flagNonExistent(entity, index, subItemIds, subItemMap).errors
}

function validateSubItemsInOrg<Entity extends SystemEntities>(
    entityName: string,
    index: number,
    organizationId: string,
    map: Map<string, Entity>
) {
    return Array.from(map.values())
        .filter((si: SystemEntityAndOrg) => {
            const isSystem = !!si.system
            const isInOrg =
                si.__organization__?.organization_id === organizationId

            return !isSystem && !isInOrg
        })
        .map((si) =>
            createEntityAPIError(
                'nonExistentChild',
                index,
                entityName,
                si.id,
                'Organization',
                organizationId
            )
        )
}
