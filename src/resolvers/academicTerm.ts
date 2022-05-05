import { Context } from 'mocha'
import { AcademicTerm } from '../entities/academicTerm'
import { Class } from '../entities/class'
import { School } from '../entities/school'
import { Status } from '../entities/status'
import { mapATtoATConnectionNode } from '../pagination/academicTermsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    AcademicTermsMutationResult,
    CreateAcademicTermInput,
    DeleteAcademicTermInput,
} from '../types/graphQL/academicTerm'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
} from '../utils/mutations/commonStructure'
import {
    DateRangeWithIndex,
    validateDateRanges,
    validateNoDateOverlapsForParent,
} from '../utils/resolvers/dateRangeValidation'
import { getMap } from '../utils/resolvers/entityMaps'
import {
    createEntityAPIError,
    createMustHaveExactlyNAPIError,
} from '../utils/resolvers/errors'

interface CreateAcademicTermsEntityMap extends EntityMap<AcademicTerm> {
    schoolsAcademicTerms: Map<AcademicTerm['school_id'], AcademicTerm[]>
    schools: Map<string, School>
}

export interface DeleteAcademicTermsEntityMap extends EntityMap<AcademicTerm> {
    mainEntity: Map<string, AcademicTerm>
    classesByAcademicTerm: Map<string, Class[]>
}

export class CreateAcademicTerms extends CreateMutation<
    AcademicTerm,
    CreateAcademicTermInput,
    AcademicTermsMutationResult,
    CreateAcademicTermsEntityMap
> {
    protected readonly EntityType = AcademicTerm
    protected inputTypeName = 'CreateAcademicTermInput'
    protected output: AcademicTermsMutationResult = { academicTerms: [] }

    async generateEntityMaps(
        input: CreateAcademicTermInput[]
    ): Promise<CreateAcademicTermsEntityMap> {
        const schoolMap = await getMap.school(
            input.map((i) => i.schoolId),
            ['academicTerms']
        )
        const schoolIdsWithATsMap = new Map<
            AcademicTerm['school_id'],
            AcademicTerm[]
        >()
        for (const [schoolId, school] of schoolMap) {
            // eslint-disable-next-line no-await-in-loop
            const existingATs = await school.academicTerms
            if (existingATs) {
                schoolIdsWithATsMap.set(
                    schoolId,
                    existingATs.filter((at) => at.status === Status.ACTIVE) // Ignore inactive ATs, they will never be reactivated
                )
            } else {
                schoolIdsWithATsMap.set(schoolId, [])
            }
        }

        return {
            schoolsAcademicTerms: schoolIdsWithATsMap,
            schools: schoolMap,
        }
    }

    authorize(
        _inputs: CreateAcademicTermInput[],
        maps: CreateAcademicTermsEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids: Array.from(maps.schools.values()).map(
                    (school) => school.organizationId
                ),
                school_ids: Array.from(maps.schools.keys()),
            },
            PermissionName.create_academic_term_20229
        )
    }

    validationOverAllInputs(inputs: CreateAcademicTermInput[]) {
        const errorMaps: Map<number, APIError>[] = []

        const dateRangeErrors = validateDateRanges(
            inputs.map((input) => {
                return {
                    startDate: input.startDate,
                    endDate: input.endDate,
                }
            })
        )
        errorMaps.push(dateRangeErrors)
        const validInputsErrorsAfterDateRanges = filterInvalidInputs(
            inputs,
            errorMaps
        )

        // Continue to validateNoDateOverlaps() validation stage with valid inputs from validateDateRanges()
        const uniqueSchoolIdsInValidInput = new Set(
            validInputsErrorsAfterDateRanges.validInputs.map(
                (validInput) => validInput.input.schoolId
            )
        )
        for (const schoolId of uniqueSchoolIdsInValidInput) {
            // Index must be preserved from original input during filtering by schoolId, so parallel data structure is created here
            const filteredInputs: DateRangeWithIndex[] = []
            for (const {
                input: validInput,
                idx,
            } of validInputsErrorsAfterDateRanges.validInputs.map(
                (inputObj, index) => ({
                    input: inputObj,
                    idx: index,
                })
            )) {
                if (validInput.input.schoolId == schoolId) {
                    filteredInputs.push({
                        index: idx,
                        startDate: validInput.input.startDate,
                        endDate: validInput.input.endDate,
                    })
                }
            }

            errorMaps.push(
                validateNoDateOverlapsForParent(
                    filteredInputs,
                    'AcademicTerm',
                    'School',
                    'schoolId',
                    schoolId
                )
            )
        }

        return filterInvalidInputs(inputs, errorMaps)
    }

    validate(
        index: number,
        _entity: AcademicTerm,
        currentInput: CreateAcademicTermInput,
        maps: CreateAcademicTermsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { schoolId, name, startDate, endDate } = currentInput

        // Does the school ID map to an existing school while fetching ATs?
        const existingAcademicTerms = maps.schoolsAcademicTerms.get(schoolId)
        if (!existingAcademicTerms) {
            errors.push(
                createEntityAPIError('nonExistent', index, 'School', schoolId)
            )
            // Not finding a school entry implies no existent school, so no point in proceeding with other errors
            return errors
        }

        // Does the uploaded AT name already exist in the school?
        for (const { name: existingATName } of existingAcademicTerms) {
            if (existingATName === name) {
                errors.push(
                    createEntityAPIError(
                        'existentChild',
                        index,
                        'AcademicTerm',
                        existingATName,
                        'School',
                        schoolId,
                        ['schoolId', 'name']
                    )
                )
                break
            }
        }

        // Does the uploaded date range overlap with existing ATs in the school?
        // Place the input AT within the context of the existing ATs, then reuse validateNoDateOverlaps()
        const existingATsWithInputAT: DateRangeWithIndex[] = existingAcademicTerms
            .map((at) => {
                return {
                    index: undefined,
                    startDate: at.start_date,
                    endDate: at.end_date,
                } as DateRangeWithIndex
            })
            .concat([{ index: index, startDate: startDate, endDate: endDate }])

        const errorMap = validateNoDateOverlapsForParent(
            existingATsWithInputAT,
            'AcademicTerm',
            'School',
            'schoolId',
            schoolId
        )
        errors.push(...Array.from(errorMap.values()))

        return errors
    }

    process(
        currentInput: CreateAcademicTermInput,
        maps: CreateAcademicTermsEntityMap
    ) {
        const { schoolId, name, startDate, endDate } = currentInput

        const academicTermToSave = new AcademicTerm()
        academicTermToSave.school = Promise.resolve(maps.schools.get(schoolId)!)
        academicTermToSave.name = name
        academicTermToSave.start_date = startDate
        academicTermToSave.end_date = endDate

        return { outputEntity: academicTermToSave }
    }

    protected async buildOutput(outputEntity: AcademicTerm): Promise<void> {
        const academicTermConnectionNode = mapATtoATConnectionNode(outputEntity)
        this.output.academicTerms.push(academicTermConnectionNode)
    }
}

export class DeleteAcademicTerms extends DeleteMutation<
    AcademicTerm,
    DeleteAcademicTermInput,
    AcademicTermsMutationResult
> {
    protected readonly EntityType = AcademicTerm
    protected readonly inputTypeName = 'DeleteAcademicTermInput'
    protected readonly output: AcademicTermsMutationResult = {
        academicTerms: [],
    }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteAcademicTermInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: DeleteAcademicTermInput[]
    ): Promise<DeleteAcademicTermsEntityMap> {
        const terms = await getMap.academicTerm(
            input.map((i) => i.id),
            ['school', 'classes']
        )

        const classesByAcademicTerm: Map<string, Class[]> = new Map()
        for (const [academicTermId, term] of terms) {
            // eslint-disable-next-line no-await-in-loop
            const classes = await term.classes
            classesByAcademicTerm.set(academicTermId, classes ?? [])
        }

        return {
            mainEntity: terms,
            classesByAcademicTerm,
        }
    }

    async authorize(
        _input: DeleteAcademicTermInput[],
        maps: DeleteAcademicTermsEntityMap
    ): Promise<void> {
        const terms = Array.from(maps.mainEntity.values())
        const organization_ids = await Promise.all(
            terms.map((t) => t.school.then((s) => s.organizationId))
        )
        const school_ids = terms.map((t) => t.school_id)
        return this.permissions.rejectIfNotAllowed(
            {
                organization_ids,
                school_ids,
            },
            PermissionName.delete_academic_term_20449
        )
    }

    validate(
        index: number,
        currentEntity: AcademicTerm,
        currentInput: DeleteAcademicTermInput,
        maps: DeleteAcademicTermsEntityMap
    ): APIError[] {
        const errors: APIError[] = []

        const classes = maps.classesByAcademicTerm.get(currentEntity.id)
        if (classes?.length) {
            errors.push(
                createMustHaveExactlyNAPIError(
                    'AcademicTerm',
                    currentInput.id,
                    'Classes',
                    0,
                    index
                )
            )
        }

        return errors
    }

    protected async buildOutput(outputEntity: AcademicTerm): Promise<void> {
        const academicTermConnectionNode = mapATtoATConnectionNode(outputEntity)
        this.output.academicTerms.push(academicTermConnectionNode)
    }
}
