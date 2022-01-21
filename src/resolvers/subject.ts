import { In } from 'typeorm'
import { Category } from '../entities/category'
import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { Subject } from '../entities/subject'
import { Context } from '../main'
import { mapSubjectToSubjectConnectionNode } from '../pagination/subjectsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CreateSubjectInput,
    SubjectsMutationOutput,
} from '../types/graphQL/subject'
import {
    CreateMutation,
    EntityMap,
    filterInvalidInputs,
    validateNoDuplicate,
    validateSubItemsArrayLength,
    validateSubItemsArrayNoDuplicates,
} from '../utils/mutations/commonStructure'
import { getMap } from '../utils/resolvers/entityMaps'
import {
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
} from '../utils/resolvers/errors'
import { flagNonExistent } from '../utils/resolvers/inputValidation'
import { ObjMap } from '../utils/stringUtils'

export type CatAndOrg = Category & { __organization__?: Organization }

export type ConflictingNameKey = {
    organizationId: string
    name: string
}
export interface CreateSubjectsEntityMap extends EntityMap<Subject> {
    organizations: Map<string, Organization>
    categories: Map<string, Category>
    conflictingNames: ObjMap<ConflictingNameKey, Subject>
}

export class CreateSubjects extends CreateMutation<
    Subject,
    CreateSubjectInput,
    SubjectsMutationOutput,
    CreateSubjectsEntityMap
> {
    protected readonly EntityType = Subject
    protected inputTypeName = 'CreateSubjectInput'
    protected output: SubjectsMutationOutput = { subjects: [] }

    constructor(
        input: CreateSubjectInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
    }

    async generateEntityMaps(
        input: CreateSubjectInput[]
    ): Promise<CreateSubjectsEntityMap> {
        const organizationIds: string[] = []
        const names: string[] = []
        const allCategoryIds: string[] = []

        input.forEach((i) => {
            organizationIds.push(i.organizationId)
            names.push(i.name)
            if (i.categoryIds) {
                allCategoryIds.push(...i.categoryIds)
            }
        })

        const categoryIds = Array.from(new Set(allCategoryIds))

        const conflictingNames = new ObjMap<ConflictingNameKey, Subject>()
        const organizations = await getMap.organization(organizationIds)
        const categories = await getMap.category(categoryIds, ['organization'])

        const matchingPreloadedSubjectArray = await Subject.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
                organization: In(organizationIds),
            },
            relations: ['organization'],
        })

        for (const s of matchingPreloadedSubjectArray) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await s.organization)!.organization_id
            const name = s.name!
            conflictingNames.set({ organizationId, name }, s)
        }

        return {
            conflictingNames,
            organizations,
            categories,
        }
    }

    authorize(input: CreateSubjectInput[]): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: input.map((i) => i.organizationId) },
            PermissionName.create_subjects_20227
        )
    }

    validationOverAllInputs(
        inputs: CreateSubjectInput[]
    ): {
        validInputs: { index: number; input: CreateSubjectInput }[]
        apiErrors: APIError[]
    } {
        const errors: APIError[] = []
        const failedDuplicateNames = validateNoDuplicate(
            inputs.map((i) => [i.organizationId, i.name].toString()),
            'subject',
            'name'
        )

        errors.push(...failedDuplicateNames.values())

        const failedSubItemsLength = validateSubItemsArrayLength(
            inputs.map((i) => i.categoryIds),
            this.inputTypeName,
            'categoryIds'
        )

        errors.push(...failedSubItemsLength.values())

        const failedSubItemsNoDuplicates = validateSubItemsArrayNoDuplicates(
            inputs.map((i) => i.categoryIds),
            this.inputTypeName,
            'categoryIds'
        )

        errors.push(...failedSubItemsNoDuplicates.values())

        return filterInvalidInputs(inputs, [
            failedDuplicateNames,
            failedSubItemsLength,
            failedSubItemsNoDuplicates,
        ])
    }

    validate(
        index: number,
        _subject: undefined,
        currentInput: CreateSubjectInput,
        maps: CreateSubjectsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, name, categoryIds } = currentInput
        const organizationMap = maps.organizations
        const conflictNamesMap = maps.conflictingNames
        const categoryMap = maps.categories

        const organization = flagNonExistent(
            Organization,
            index,
            [organizationId],
            organizationMap
        )
        errors.push(...organization.errors)

        const conflictingNameSubjectId = conflictNamesMap.get({
            organizationId,
            name,
        })?.id

        if (conflictingNameSubjectId) {
            errors.push(
                createExistentEntityAttributeAPIError(
                    'Subject',
                    conflictingNameSubjectId,
                    'name',
                    name,
                    index
                )
            )
        }

        if (categoryIds) {
            const categories = flagNonExistent(
                Category,
                index,
                categoryIds,
                categoryMap
            )

            errors.push(...categories.errors)

            const invalidCatsInOrg = Array.from(categoryMap.values())
                .filter((c) => {
                    const cat = c as CatAndOrg
                    const isSystem = cat.system
                    const isInOrg =
                        cat.__organization__?.organization_id === organizationId
                    return !isSystem && !isInOrg
                })
                .map(({ id }) =>
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'Category',
                        id,
                        'Organization',
                        organizationId
                    )
                )

            errors.push(...invalidCatsInOrg)
        }

        return errors
    }

    process(currentInput: CreateSubjectInput, maps: CreateSubjectsEntityMap) {
        const { organizationId, name, categoryIds } = currentInput
        const subject = new Subject()
        subject.name = name
        subject.organization = Promise.resolve(
            maps.organizations.get(organizationId) as Organization
        )

        if (categoryIds) {
            const subjectCategories = Array.from(
                categoryIds,
                (categoryId) => maps.categories.get(categoryId)!
            )

            subject.categories = Promise.resolve(subjectCategories)
        }

        return { outputEntity: subject }
    }

    protected async buildOutput(outputSubject: Subject): Promise<void> {
        const subjectConnectionNode = await mapSubjectToSubjectConnectionNode(
            outputSubject
        )

        this.output.subjects.push(subjectConnectionNode)
    }
}
