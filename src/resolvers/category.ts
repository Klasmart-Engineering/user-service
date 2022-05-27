import { In } from 'typeorm'
import { Category } from '../entities/category'
import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import { mapCategoryToCategoryConnectionNode } from '../pagination/categoriesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    CategoriesMutationResult,
    CreateCategoryInput,
    DeleteCategoryInput,
    UpdateCategoryInput,
    AddSubcategoriesToCategoryInput,
    RemoveSubcategoriesFromCategoryInput,
} from '../types/graphQL/category'
import { createExistentEntityAttributeAPIError } from '../utils/resolvers/errors'
import {
    AddMutation,
    CreateMutation,
    DeleteEntityMap,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    RemoveMutation,
    UpdateMutation,
    validateAtLeastOne,
    validateNoDuplicate,
    validateNoDuplicateAttribute,
    validateSubItemsLengthAndNoDuplicates,
} from '../utils/mutations/commonStructure'
import { objectToKey, ObjMap } from '../utils/stringUtils'
import { ConflictingNameKey, getMap } from '../utils/resolvers/entityMaps'
import {
    flagExistentChild,
    flagNonExistent,
    flagNonExistentChild,
    validateSubItemsInOrg,
} from '../utils/resolvers/inputValidation'
import { uniqueAndTruthy } from '../utils/clean'
export interface CreateCategoriesEntityMap extends EntityMap<Category> {
    organizations: Map<string, Organization>
    subcategories: Map<string, Subcategory>
    conflictingNames: ObjMap<ConflictingNameKey, Category>
}

export interface UpdateCategoriesEntityMap extends EntityMap<Category> {
    mainEntity: Map<string, Category>
    subcategories: Map<string, Subcategory>
    conflictingNames: ObjMap<ConflictingNameKey, Category>
    organizationIds: string[]
}

export interface AddSubcategoriesToCategoriesEntityMap
    extends EntityMap<Category> {
    mainEntity: Map<string, Category>
    subcategories: Map<string, Subcategory>
    categoriesSubcategories: Map<string, Subcategory[]>
    organizationIds: string[]
}

export interface RemoveSubcategoriesFromCategoriesEntityMap
    extends EntityMap<Category> {
    mainEntity: Map<string, Category>
    subcategories: Map<string, Subcategory>
    categoriesSubcategories: Map<string, Subcategory[]>
    organizationIds: string[]
}

export class CreateCategories extends CreateMutation<
    Category,
    CreateCategoryInput,
    CategoriesMutationResult,
    CreateCategoriesEntityMap
> {
    protected readonly EntityType = Category
    protected inputTypeName = 'CreateCategoryInput'
    protected output: CategoriesMutationResult = { categories: [] }

    async generateEntityMaps(
        input: CreateCategoryInput[]
    ): Promise<CreateCategoriesEntityMap> {
        const organizationIds: string[] = []
        const names: string[] = []
        const allSubcategoryIds: string[] = []

        input.forEach((i) => {
            organizationIds.push(i.organizationId)
            names.push(i.name)
            if (i.subcategoryIds) allSubcategoryIds.push(...i.subcategoryIds)
        })

        const subcategoryIds = [...new Set(allSubcategoryIds)]
        const organizations = getMap.organization(organizationIds)
        const subcategories = getMap.subcategory(subcategoryIds, [
            'organization',
        ])

        const matchingPreloadedCategoryArray = Category.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
                organization: In(organizationIds),
            },
            relations: ['organization'],
        })

        const conflictingNames = new ObjMap<ConflictingNameKey, Category>()
        for (const c of await matchingPreloadedCategoryArray) {
            const organizationId = c.organizationId
            const name = c.name
            conflictingNames.set({ organizationId, name }, c)
        }

        return {
            conflictingNames,
            organizations: await organizations,
            subcategories: await subcategories,
        }
    }

    authorize(input: CreateCategoryInput[]): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: input.map((i) => i.organizationId) },
            PermissionName.create_subjects_20227
        )
    }

    validationOverAllInputs(
        inputs: CreateCategoryInput[]
    ): {
        validInputs: { index: number; input: CreateCategoryInput }[]
        apiErrors: APIError[]
    } {
        const failedDuplicateNames = validateNoDuplicate(
            inputs.map((i) =>
                objectToKey({ organizationId: i.organizationId, name: i.name })
            ),
            this.inputTypeName,
            ['organizationId', 'name']
        )

        const failedSubcategories = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subcategoryIds'
        )

        return filterInvalidInputs(inputs, [
            failedDuplicateNames,
            ...failedSubcategories,
        ])
    }

    validate(
        index: number,
        _category: undefined,
        currentInput: CreateCategoryInput,
        maps: CreateCategoriesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, name, subcategoryIds } = currentInput
        const conflictNamesMap = maps.conflictingNames
        const subcategoryMap = maps.subcategories

        const organization = flagNonExistent(
            Organization,
            index,
            [organizationId],
            maps.organizations
        )
        errors.push(...organization.errors)

        const conflictingNameCategoryId = conflictNamesMap.get({
            organizationId,
            name,
        })?.id
        if (conflictingNameCategoryId) {
            errors.push(
                createExistentEntityAttributeAPIError(
                    'Category',
                    conflictingNameCategoryId,
                    'name',
                    name,
                    index
                )
            )
        }

        if (!subcategoryIds) return errors
        const subcategories = flagNonExistent(
            Subcategory,
            index,
            subcategoryIds,
            subcategoryMap
        )
        errors.push(...subcategories.errors)

        const invalidSubcategoriesInOrg = validateSubItemsInOrg(
            Subcategory,
            subcategories.values.map((s) => s.id),
            index,
            maps.subcategories,
            organizationId
        )
        errors.push(...invalidSubcategoriesInOrg)

        return errors
    }

    protected process(
        currentInput: CreateCategoryInput,
        maps: CreateCategoriesEntityMap
    ) {
        const { organizationId, name, subcategoryIds } = currentInput

        const category = new Category()
        category.name = name
        category.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        if (subcategoryIds) {
            const categorySubcategories = Array.from(
                subcategoryIds,
                (subcategoryId) => maps.subcategories.get(subcategoryId)!
            )

            category.subcategories = Promise.resolve(categorySubcategories)
        }

        return { outputEntity: category }
    }

    protected async buildOutput(outputCategory: Category): Promise<void> {
        const categoryConnectionNode = mapCategoryToCategoryConnectionNode(
            outputCategory
        )

        this.output.categories.push(categoryConnectionNode)
    }
}

export class UpdateCategories extends UpdateMutation<
    Category,
    UpdateCategoryInput,
    CategoriesMutationResult,
    UpdateCategoriesEntityMap
> {
    protected readonly EntityType = Category
    protected inputTypeName = 'UpdateCategoryInput'
    protected mainEntityIds: string[] = []
    protected output: CategoriesMutationResult = { categories: [] }

    constructor(
        input: UpdateCategoryInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        for (const val of input) {
            this.mainEntityIds.push(val.id)
        }
    }

    async generateEntityMaps(
        input: UpdateCategoryInput[]
    ): Promise<UpdateCategoriesEntityMap> {
        const ids: string[] = []
        const names: string[] = []
        const subcategoryIds: string[] = []

        input.forEach((i) => {
            ids.push(i.id)
            if (i.name) names.push(i.name)
            if (i.subcategoryIds) subcategoryIds.push(...i.subcategoryIds)
        })

        const preloadedCategories = getMap.category(ids, ['organization'])
        const preloadedSubcategories = getMap.subcategory(subcategoryIds, [
            'organization',
        ])
        const preloadedMatchingNames = Category.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        const preloadedOrgIds = preloadedCategories
            .then((categoryMap) =>
                Array.from(categoryMap.values(), (c) => c.organizationId)
            )
            .then(uniqueAndTruthy)

        const conflictingNames = new ObjMap<ConflictingNameKey, Category>()
        for (const p of await preloadedMatchingNames) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await p.organization)?.organization_id
            const categoryName = p.name
            conflictingNames.set({ organizationId, name: categoryName }, p)
        }

        return {
            mainEntity: await preloadedCategories,
            subcategories: await preloadedSubcategories,
            conflictingNames,
            organizationIds: await preloadedOrgIds,
        }
    }

    async authorize(
        _input: UpdateCategoryInput[],
        maps: UpdateCategoriesEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.edit_subjects_20337
        )
    }

    validationOverAllInputs(
        inputs: UpdateCategoryInput[],
        maps: UpdateCategoriesEntityMap
    ): {
        validInputs: { index: number; input: UpdateCategoryInput }[]
        apiErrors: APIError[]
    } {
        const failedAtLeastOne = validateAtLeastOne(
            inputs,
            this.inputTypeName,
            ['name', 'subcategoryIds']
        )

        const failedDuplicates = validateNoDuplicate(
            inputs.map((i) => i.id),
            this.inputTypeName,
            ['id']
        )

        const values = []
        for (const { id, name } of inputs) {
            const category = maps.mainEntity.get(id)
            let organizationId = undefined
            // when category has not organization, which is something common for system categories,
            // the organizationId is setted as '' to have a way to identify the system ones
            if (category) organizationId = category.organizationId || ''

            values.push({ entityId: organizationId, attributeValue: name })
        }

        const failedDuplicateInOrg = validateNoDuplicateAttribute(
            values,
            'Category',
            'name'
        )

        const failedSubcategories = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subcategoryIds'
        )

        return filterInvalidInputs(inputs, [
            failedAtLeastOne,
            failedDuplicates,
            failedDuplicateInOrg,
            ...failedSubcategories,
        ])
    }

    validate(
        index: number,
        _category: Category,
        currentInput: UpdateCategoryInput,
        maps: UpdateCategoriesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { id, name, subcategoryIds } = currentInput

        const categoryExists = flagNonExistent(
            Category,
            index,
            [id],
            maps.mainEntity
        )
        errors.push(...categoryExists.errors)

        if (categoryExists.values.length !== 1) return errors
        const organizationId = categoryExists.values[0].organizationId

        if (name) {
            const conflictingNameCategoryId = maps.conflictingNames.get({
                organizationId,
                name,
            })?.id

            if (conflictingNameCategoryId) {
                errors.push(
                    createExistentEntityAttributeAPIError(
                        'Category',
                        conflictingNameCategoryId,
                        'name',
                        name,
                        index
                    )
                )
            }
        }

        if (subcategoryIds) {
            const subcategories = flagNonExistent(
                Subcategory,
                index,
                subcategoryIds,
                maps.subcategories
            )

            errors.push(...subcategories.errors)
            errors.push(
                ...validateSubItemsInOrg(
                    Subcategory,
                    subcategories.values.map((s) => s.id),
                    index,
                    maps.subcategories,
                    organizationId
                )
            )
        }

        return errors
    }

    protected process(
        currentInput: UpdateCategoryInput,
        maps: UpdateCategoriesEntityMap
    ): ProcessedResult<Category, Category> {
        const { id, name, subcategoryIds } = currentInput
        const category = maps.mainEntity.get(id)!

        category.name = name || category.name

        if (subcategoryIds) {
            category.subcategories = Promise.resolve(
                Array.from(
                    subcategoryIds,
                    (sid) => maps.subcategories.get(sid)!
                )
            )
        }

        return { outputEntity: category }
    }

    protected async buildOutput(outputCategory: Category): Promise<void> {
        const categoryConnectionNode = mapCategoryToCategoryConnectionNode(
            outputCategory
        )

        this.output.categories.push(categoryConnectionNode)
    }
}

export class DeleteCategories extends DeleteMutation<
    Category,
    DeleteCategoryInput,
    CategoriesMutationResult
> {
    protected readonly EntityType = Category
    protected readonly inputTypeName = 'DeleteCategoryInput'
    protected readonly output: CategoriesMutationResult = { categories: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteCategoryInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(): Promise<DeleteEntityMap<Category>> {
        const map = await getMap.category(this.mainEntityIds, ['organization'])
        return { mainEntity: map }
    }

    protected async authorize(
        _input: DeleteCategoryInput[],
        entityMaps: DeleteEntityMap<Category>
    ) {
        const organizationIds: string[] = []
        for (const { organizationId } of entityMaps.mainEntity.values()) {
            if (organizationId) organizationIds.push(organizationId)
        }
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_subjects_20447
        )
    }

    protected async buildOutput(currentEntity: Category): Promise<void> {
        this.output.categories.push(
            mapCategoryToCategoryConnectionNode(currentEntity)
        )
    }
}

export class AddSubcategoriesToCategories extends AddMutation<
    Category,
    AddSubcategoriesToCategoryInput,
    CategoriesMutationResult,
    AddSubcategoriesToCategoriesEntityMap
> {
    protected readonly EntityType = Category
    protected inputTypeName = 'AddSubcategoriesToCategoryInput'
    protected mainEntityIds: string[]
    protected output: CategoriesMutationResult = { categories: [] }

    constructor(
        input: AddSubcategoriesToCategoryInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.categoryId)
    }

    async generateEntityMaps(
        input: AddSubcategoriesToCategoryInput[]
    ): Promise<AddSubcategoriesToCategoriesEntityMap> {
        return generateAddRemoveSubcategoriesMaps(input)
    }

    async authorize(
        _input: AddSubcategoriesToCategoryInput[],
        maps: AddSubcategoriesToCategoriesEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.edit_subjects_20337
        )
    }

    validationOverAllInputs(
        inputs: AddSubcategoriesToCategoryInput[]
    ): {
        validInputs: { index: number; input: AddSubcategoriesToCategoryInput }[]
        apiErrors: APIError[]
    } {
        const categoryIdErrorMap = validateNoDuplicate(
            inputs.map((cls) => cls.categoryId),
            this.inputTypeName,
            ['categoryId']
        )

        const subcategoryIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subcategoryIds'
        )

        return filterInvalidInputs(inputs, [
            categoryIdErrorMap,
            ...subcategoryIdsErrorMap,
        ])
    }

    validate = (
        index: number,
        _currentCategory: Category,
        currentInput: AddSubcategoriesToCategoryInput,
        maps: AddSubcategoriesToCategoriesEntityMap
    ): APIError[] => {
        const errors: APIError[] = []
        const { categoryId, subcategoryIds } = currentInput

        const categories = flagNonExistent(
            Category,
            index,
            [categoryId],
            maps.mainEntity
        )
        errors.push(...categories.errors)

        const subcategories = flagNonExistent(
            Subcategory,
            index,
            subcategoryIds,
            maps.subcategories
        )
        errors.push(...subcategories.errors)

        if (categories.values.length !== 1) return errors
        const invalidSubcategoriesInOrg = validateSubItemsInOrg(
            Subcategory,
            subcategories.values.map((s) => s.id),
            index,
            maps.subcategories,
            categories.values[0].organizationId
        )

        errors.push(...invalidSubcategoriesInOrg)

        const currentCategorySubcategories = new Set(
            maps.categoriesSubcategories.get(categoryId)?.map((s) => s.id)
        )

        const alreadyAddedErrors = flagExistentChild(
            Category,
            Subcategory,
            index,
            categoryId,
            subcategoryIds,
            currentCategorySubcategories
        )

        errors.push(...alreadyAddedErrors)

        return errors
    }

    process(
        currentInput: AddSubcategoriesToCategoryInput,
        maps: AddSubcategoriesToCategoriesEntityMap,
        index: number
    ) {
        const { categoryId, subcategoryIds } = currentInput
        const currentCategory = maps.mainEntity.get(this.mainEntityIds[index])!
        const subcategoriesToAdd: Subcategory[] = []

        for (const subcategoryId of subcategoryIds) {
            const subcategoryToAdd = maps.subcategories.get(subcategoryId)!
            subcategoriesToAdd.push(subcategoryToAdd)
        }

        const preExistentSubcategories = maps.categoriesSubcategories.get(
            categoryId
        )!
        currentCategory.subcategories = Promise.resolve([
            ...preExistentSubcategories,
            ...subcategoriesToAdd,
        ])
        return { outputEntity: currentCategory }
    }

    protected buildOutput = async (
        currentCategory: Category
    ): Promise<void> => {
        this.output.categories.push(
            mapCategoryToCategoryConnectionNode(currentCategory)
        )
    }
}

export class RemoveSubcategoriesFromCategories extends RemoveMutation<
    Category,
    RemoveSubcategoriesFromCategoryInput,
    CategoriesMutationResult,
    RemoveSubcategoriesFromCategoriesEntityMap
> {
    protected readonly EntityType = Category
    protected inputTypeName = 'RemoveSubcategoriesFromCategoryInput'
    protected mainEntityIds: string[]
    protected output: CategoriesMutationResult = { categories: [] }

    constructor(
        input: RemoveSubcategoriesFromCategoryInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.categoryId)
    }

    async generateEntityMaps(
        input: RemoveSubcategoriesFromCategoryInput[]
    ): Promise<RemoveSubcategoriesFromCategoriesEntityMap> {
        return generateAddRemoveSubcategoriesMaps(input)
    }

    async authorize(
        _input: RemoveSubcategoriesFromCategoryInput[],
        maps: RemoveSubcategoriesFromCategoriesEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.edit_subjects_20337
        )
    }

    validationOverAllInputs(
        inputs: RemoveSubcategoriesFromCategoryInput[]
    ): {
        validInputs: {
            index: number
            input: RemoveSubcategoriesFromCategoryInput
        }[]
        apiErrors: APIError[]
    } {
        const categoryIdErrorMap = validateNoDuplicate(
            inputs.map((i) => i.categoryId),
            this.inputTypeName,
            ['categoryId']
        )

        const subcategoryIdsErrorMap = validateSubItemsLengthAndNoDuplicates(
            inputs,
            this.inputTypeName,
            'subcategoryIds'
        )

        return filterInvalidInputs(inputs, [
            categoryIdErrorMap,
            ...subcategoryIdsErrorMap,
        ])
    }

    validate(
        index: number,
        currentCategory: Category,
        currentInput: RemoveSubcategoriesFromCategoryInput,
        maps: RemoveSubcategoriesFromCategoriesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { categoryId, subcategoryIds } = currentInput

        const categories = flagNonExistent(
            Category,
            index,
            [categoryId],
            maps.mainEntity
        )
        errors.push(...categories.errors)

        const subcategories = flagNonExistent(
            Subcategory,
            index,
            subcategoryIds,
            maps.subcategories
        )
        errors.push(...subcategories.errors)

        if (categories.values.length !== 1) return errors
        const currentCategorySubcategories = new Map(
            maps.categoriesSubcategories.get(categoryId)?.map((c) => [c.id, c])
        )
        const subcategoryInCategoryErrors = flagNonExistentChild(
            Category,
            Subcategory,
            index,
            categoryId,
            subcategories.values.map((s) => s.id),
            new Set(
                Array.from(currentCategorySubcategories.values()).map(
                    (subcategory) => subcategory.id
                )
            )
        )
        errors.push(...subcategoryInCategoryErrors)

        return errors
    }

    process(
        currentInput: RemoveSubcategoriesFromCategoryInput,
        maps: RemoveSubcategoriesFromCategoriesEntityMap,
        index: number
    ) {
        const { categoryId, subcategoryIds } = currentInput
        const currentCategory = maps.mainEntity.get(this.mainEntityIds[index])!
        const subcategoryIdsSet = new Set(subcategoryIds)
        const preExistentSubcategories = maps.categoriesSubcategories.get(
            categoryId
        )!

        const keptSubcategories = preExistentSubcategories.filter(
            (subcategory) => !subcategoryIdsSet.has(subcategory.id)
        )

        currentCategory.subcategories = Promise.resolve(keptSubcategories)
        return { outputEntity: currentCategory }
    }

    protected buildOutput = async (
        currentCategory: Category
    ): Promise<void> => {
        this.output.categories.push(
            mapCategoryToCategoryConnectionNode(currentCategory)
        )
    }
}

async function generateAddRemoveSubcategoriesMaps(
    input:
        | AddSubcategoriesToCategoryInput[]
        | RemoveSubcategoriesFromCategoryInput[]
) {
    const categoryIds = input.map((i) => i.categoryId)
    const categoryMap = getMap.category(categoryIds, [
        'organization',
        'subcategories',
    ])

    const preloadedOrgIds = categoryMap
        .then((map) => Array.from(map.values(), (c) => c.organizationId))
        .then(uniqueAndTruthy)

    const subcategoryIds = input.flatMap((i) => i.subcategoryIds)
    const subcategoryMap = getMap.subcategory(subcategoryIds, ['organization'])

    const categoriesSubcategories = new Map<string, Subcategory[]>()
    for (const category of (await categoryMap).values()) {
        // eslint-disable-next-line no-await-in-loop
        const subcategories = (await category.subcategories) || []
        categoriesSubcategories.set(category.id, subcategories)
    }

    return {
        mainEntity: await categoryMap,
        subcategories: await subcategoryMap,
        categoriesSubcategories,
        organizationIds: await preloadedOrgIds,
    }
}
