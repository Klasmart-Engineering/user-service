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
    UpdateSubjectInput,
    DeleteSubjectInput,
    SubjectsMutationOutput,
} from '../types/graphQL/subject'
import {
    ConflictingNameKey,
    CreateMutation,
    UpdateMutation,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
    validateNoDuplicate,
    validateAtLeastOne,
    validateNoDuplicateAttribute,
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
type SubjectAndOrg = Subject & { __organization__?: Organization }

export interface CreateSubjectsEntityMap extends EntityMap<Subject> {
    organizations: Map<string, Organization>
    categories: Map<string, Category>
    conflictingNames: ObjMap<ConflictingNameKey, Subject>
}

export interface UpdateSubjectsEntityMap extends EntityMap<Subject> {
    mainEntity: Map<string, Subject>
    categories: Map<string, Category>
    conflictingNames: ObjMap<ConflictingNameKey, Subject>
}

export interface DeleteSubjectsEntityMap extends EntityMap<Subject> {
    mainEntity: Map<string, Subject>
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
                (categoryId: string) => maps.categories.get(categoryId)!
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

export class UpdateSubjects extends UpdateMutation<
    Subject,
    UpdateSubjectInput,
    SubjectsMutationOutput,
    UpdateSubjectsEntityMap
> {
    protected readonly EntityType = Subject
    protected inputTypeName = 'UpdateSubjectInput'
    protected mainEntityIds: string[] = []
    protected output: SubjectsMutationOutput = { subjects: [] }

    constructor(
        input: UpdateSubjectInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)

        for (const val of input) {
            this.mainEntityIds.push(val.id)
        }
    }

    async generateEntityMaps(
        input: UpdateSubjectInput[]
    ): Promise<UpdateSubjectsEntityMap> {
        const ids: string[] = []
        const names: string[] = []
        const categoryIds: string[] = []

        input.forEach((i) => {
            ids.push(i.id)
            if (i.name) names.push(i.name)
            if (i.categoryIds) categoryIds.push(...i.categoryIds)
        })

        const preloadedSubjects = getMap.subject(ids, ['organization'])
        const preloadedCategories = getMap.category(categoryIds, [
            'organization',
        ])
        const preloadedMatchingNames = await Subject.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        const conflictingNames = new ObjMap<ConflictingNameKey, Subject>()

        for (const s of preloadedMatchingNames) {
            const organizationId = (s as SubjectAndOrg).__organization__
                ?.organization_id

            const subjectName = s.name!
            conflictingNames.set({ organizationId, name: subjectName }, s)
        }

        return {
            mainEntity: await preloadedSubjects,
            categories: await preloadedCategories,
            conflictingNames,
        }
    }

    async authorize(
        _input: UpdateSubjectInput[],
        maps: UpdateSubjectsEntityMap
    ): Promise<void> {
        const organizationIds: string[] = []
        const subjects = [...maps.mainEntity.values()]

        for (const s of subjects) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await s.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.edit_subjects_20337
        )
    }

    validationOverAllInputs(
        inputs: UpdateSubjectInput[],
        maps: UpdateSubjectsEntityMap
    ): {
        validInputs: { index: number; input: UpdateSubjectInput }[]
        apiErrors: APIError[]
    } {
        const errors: APIError[] = []
        const failedAtLeastOne = validateAtLeastOne(inputs, 'Subject', [
            'name',
            'categoryIds',
        ])

        errors.push(...failedAtLeastOne.values())

        const failedDuplicates = validateNoDuplicate(
            inputs.map((i) => i.id),
            'subject',
            'id'
        )

        errors.push(...failedDuplicates.values())

        const values = []
        for (const { id, name } of inputs) {
            const subject = maps.mainEntity.get(id) as SubjectAndOrg
            let organizationId = undefined

            if (subject) {
                organizationId = subject.__organization__?.organization_id || ''
            }

            values.push({ entityId: organizationId, attributeValue: name })
        }

        const failedDuplicateInOrg = validateNoDuplicateAttribute(
            values,
            'Subject',
            'name'
        )

        errors.push(...failedDuplicateInOrg.values())

        const failedCategoriesLength = validateSubItemsArrayLength(
            inputs.map((i) => i.categoryIds),
            this.inputTypeName,
            'categoryIds'
        )

        errors.push(...failedCategoriesLength.values())

        const failedCategoriesNoDuplicates = validateSubItemsArrayNoDuplicates(
            inputs.map((i) => i.categoryIds),
            this.inputTypeName,
            'categoryIds'
        )

        errors.push(...failedCategoriesNoDuplicates.values())

        return filterInvalidInputs(inputs, [
            failedAtLeastOne,
            failedDuplicates,
            failedDuplicateInOrg,
            failedCategoriesLength,
            failedCategoriesNoDuplicates,
        ])
    }

    validate(
        index: number,
        subject: Subject,
        currentInput: UpdateSubjectInput,
        maps: UpdateSubjectsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { id, name, categoryIds } = currentInput
        const subjectMap = maps.mainEntity
        const categoryMap = maps.categories
        const conflictNamesMap = maps.conflictingNames
        const subjectExists = flagNonExistent(Subject, index, [id], subjectMap)

        errors.push(...subjectExists.errors)

        if (!subjectExists.values.length) return errors

        const organizationId = (subject as SubjectAndOrg).__organization__
            ?.organization_id

        if (name) {
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
                .map((c) =>
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'Category',
                        c.id,
                        'Organization',
                        organizationId
                    )
                )

            errors.push(...invalidCatsInOrg)
        }

        return errors
    }

    process(currentInput: UpdateSubjectInput, maps: UpdateSubjectsEntityMap) {
        const { id, name, categoryIds } = currentInput
        const subject = maps.mainEntity.get(id)!

        subject.name = name || subject.name

        if (categoryIds) {
            subject.categories = Promise.resolve(
                Array.from(categoryIds, (cid) => maps.categories.get(cid)!)
            )
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

export class DeleteSubjects extends DeleteMutation<
    Subject,
    DeleteSubjectInput,
    SubjectsMutationOutput
> {
    protected readonly EntityType = Subject
    protected readonly inputTypeName = 'DeleteSubjectInput'
    protected readonly output: SubjectsMutationOutput = { subjects: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteSubjectInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: DeleteSubjectInput[]
    ): Promise<DeleteSubjectsEntityMap> {
        const subjects = getMap.subject(
            input.map((i) => i.id),
            ['organization']
        )

        return { mainEntity: await subjects }
    }

    async authorize(
        _input: DeleteSubjectInput[],
        maps: DeleteSubjectsEntityMap
    ): Promise<void> {
        const organizationIds: string[] = []
        const subjects = [...maps.mainEntity.values()]

        for (const s of subjects) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await s.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_subjects_20447
        )
    }

    async buildOutput(subject: Subject): Promise<void> {
        this.output.subjects.push(mapSubjectToSubjectConnectionNode(subject))
    }
}
