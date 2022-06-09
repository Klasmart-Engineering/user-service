import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import { mapSubcategoryToSubcategoryConnectionNode } from '../pagination/subcategoriesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    DeleteSubcategoryInput,
    SubcategoriesMutationResult,
    UpdateSubcategoryInput,
    CreateSubcategoryInput,
} from '../types/graphQL/subcategory'
import { createExistentEntityAttributeAPIError } from '../utils/resolvers/errors'
import {
    CreateMutation,
    DeleteEntityMap,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    UpdateMutation,
    validateNoDuplicate,
} from '../utils/resolvers/commonStructure'
import { ConflictingNameKey, getMap } from '../utils/resolvers/entityMaps'
import { objectToKey, ObjMap } from '../utils/stringUtils'
import { flagNonExistent } from '../utils/resolvers/inputValidation'
import { In } from 'typeorm'

export interface CreateSubcategoriesEntityMap extends EntityMap<Subcategory> {
    organizations: Map<string, Organization>
    conflictingNames: ObjMap<ConflictingNameKey, Subcategory>
}

export interface UpdateSubcategoriesEntityMap extends EntityMap<Subcategory> {
    mainEntity: Map<string, Subcategory>
    conflictingNames: ObjMap<ConflictingNameKey, Subcategory>
    organizationIds: string[]
}

export class CreateSubcategories extends CreateMutation<
    Subcategory,
    CreateSubcategoryInput,
    SubcategoriesMutationResult,
    CreateSubcategoriesEntityMap
> {
    protected readonly EntityType = Subcategory
    protected inputTypeName = 'CreateSubcategoryInput'
    protected output: SubcategoriesMutationResult = { subcategories: [] }

    async generateEntityMaps(
        input: CreateSubcategoryInput[]
    ): Promise<CreateSubcategoriesEntityMap> {
        const organizationIds: string[] = []
        const names: string[] = []

        input.forEach((i) => {
            organizationIds.push(i.organizationId)
            names.push(i.name)
        })

        const organizations = await getMap.organization(organizationIds)

        const matchingPreloadedSubcategoryArray = await Subcategory.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
                organization: In(organizationIds),
            },
            relations: ['organization'],
        })

        const conflictingNames = new ObjMap<ConflictingNameKey, Subcategory>()
        for (const subcat of matchingPreloadedSubcategoryArray) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await subcat.organization)!.organization_id
            const name = subcat.name
            conflictingNames.set({ organizationId, name }, subcat)
        }

        return {
            conflictingNames,
            organizations,
        }
    }

    authorize(input: CreateSubcategoryInput[]): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: input.map((i) => i.organizationId) },
            PermissionName.create_subjects_20227
        )
    }

    validationOverAllInputs(
        inputs: CreateSubcategoryInput[]
    ): {
        validInputs: { index: number; input: CreateSubcategoryInput }[]
        apiErrors: APIError[]
    } {
        // Checking duplicates in organizationId and name combination
        const failedDuplicateNames = validateNoDuplicate(
            inputs.map((i) =>
                objectToKey({ organizationId: i.organizationId, name: i.name })
            ),
            this.inputTypeName,
            ['name']
        )

        return filterInvalidInputs(inputs, [failedDuplicateNames])
    }

    validate(
        index: number,
        _category: undefined,
        currentInput: CreateSubcategoryInput,
        maps: CreateSubcategoriesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, name } = currentInput
        const conflictNamesMap = maps.conflictingNames

        // Checking that an Organization with the given organizationId exists
        const organization = flagNonExistent(
            Organization,
            index,
            [organizationId],
            maps.organizations
        )
        errors.push(...organization.errors)

        // Checking that there are not other Subcategory with the same name inside the Organization
        const conflictingNameSubcategoryId = conflictNamesMap.get({
            organizationId,
            name,
        })?.id

        if (conflictingNameSubcategoryId) {
            errors.push(
                createExistentEntityAttributeAPIError(
                    'Subcategory',
                    conflictingNameSubcategoryId,
                    'name',
                    name,
                    index
                )
            )
        }

        return errors
    }

    protected process(
        currentInput: CreateSubcategoryInput,
        maps: CreateSubcategoriesEntityMap
    ) {
        const { organizationId, name } = currentInput

        const subcategory = new Subcategory()
        subcategory.name = name
        subcategory.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        return { outputEntity: subcategory }
    }

    protected async buildOutput(outputSubcategory: Subcategory): Promise<void> {
        const categoryConnectionNode = mapSubcategoryToSubcategoryConnectionNode(
            outputSubcategory
        )

        this.output.subcategories.push(categoryConnectionNode)
    }
}

export class UpdateSubcategories extends UpdateMutation<
    Subcategory,
    UpdateSubcategoryInput,
    SubcategoriesMutationResult,
    UpdateSubcategoriesEntityMap
> {
    protected readonly EntityType = Subcategory
    protected inputTypeName = 'UpdateSubcategoryInput'
    protected mainEntityIds: string[] = []
    protected output: SubcategoriesMutationResult = { subcategories: [] }

    constructor(
        input: UpdateSubcategoryInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        for (const val of input) {
            this.mainEntityIds.push(val.id)
        }
    }

    async generateEntityMaps(
        input: UpdateSubcategoryInput[]
    ): Promise<UpdateSubcategoriesEntityMap> {
        const ids: string[] = []
        const names: string[] = []

        input.forEach((i) => {
            ids.push(i.id)
            if (i.name) names.push(i.name)
        })

        const preloadedSubcategories = getMap.subcategory(ids, ['organization'])
        const preloadedMatchingNames = Subcategory.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        const preloadedOrgIds = preloadedSubcategories
            .then((subCats) =>
                Promise.all(
                    Array.from(subCats.values(), (sc) =>
                        sc.organization?.then(
                            (org) => org && org.organization_id
                        )
                    )
                ).then((orgIds) => orgIds.filter((id): id is string => !!id))
            )
            .then((orgIds) => [...new Set(orgIds)])

        const conflictingNames = new ObjMap<ConflictingNameKey, Subcategory>()
        for (const p of await preloadedMatchingNames) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await p.organization)?.organization_id
            const subcategoryName = p.name
            conflictingNames.set({ organizationId, name: subcategoryName }, p)
        }

        return {
            mainEntity: await preloadedSubcategories,
            conflictingNames,
            organizationIds: await preloadedOrgIds,
        }
    }

    async authorize(
        _input: UpdateSubcategoryInput[],
        maps: UpdateSubcategoriesEntityMap
    ): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.edit_subjects_20337
        )
    }

    validationOverAllInputs(
        inputs: UpdateSubcategoryInput[]
    ): {
        validInputs: { index: number; input: UpdateSubcategoryInput }[]
        apiErrors: APIError[]
    } {
        // Checking that you are not editing the same subcategory more than once
        const failedDuplicates = validateNoDuplicate(
            inputs.map((i) => i.id),
            this.inputTypeName,
            ['id']
        )

        return filterInvalidInputs(inputs, [failedDuplicates])
    }

    validate(
        index: number,
        subcategory: Subcategory,
        currentInput: UpdateSubcategoryInput,
        maps: UpdateSubcategoriesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { id, name } = currentInput

        // Checking that the subcategory exist
        const subcategoryExists = flagNonExistent(
            Subcategory,
            index,
            [id],
            maps.mainEntity
        )
        errors.push(...subcategoryExists.errors)

        if (!subcategoryExists.values.length) return errors

        const organizationId = subcategory.organization_id

        if (name) {
            // Checking that there is not another subcategory in the same organization with the same name
            const conflictingNameSubcategoryId = maps.conflictingNames.get({
                organizationId,
                name,
            })?.id

            if (conflictingNameSubcategoryId) {
                errors.push(
                    createExistentEntityAttributeAPIError(
                        'Subcategory',
                        conflictingNameSubcategoryId,
                        'name',
                        name,
                        index
                    )
                )
            }
        }

        return errors
    }

    protected process(
        currentInput: UpdateSubcategoryInput,
        maps: UpdateSubcategoriesEntityMap
    ): ProcessedResult<Subcategory, Subcategory> {
        const { id, name } = currentInput
        const subcategory = maps.mainEntity.get(id)!

        subcategory.name = name || subcategory.name

        return { outputEntity: subcategory }
    }

    protected async buildOutput(outputCategory: Subcategory): Promise<void> {
        const categoryConnectionNode = mapSubcategoryToSubcategoryConnectionNode(
            outputCategory
        )

        this.output.subcategories.push(categoryConnectionNode)
    }
}

export class DeleteSubcategories extends DeleteMutation<
    Subcategory,
    DeleteSubcategoryInput,
    SubcategoriesMutationResult
> {
    protected readonly EntityType = Subcategory
    protected readonly inputTypeName = 'DeleteSubcategoryInput'
    protected readonly output: SubcategoriesMutationResult = {
        subcategories: [],
    }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteSubcategoryInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    protected async generateEntityMaps(): Promise<
        DeleteEntityMap<Subcategory>
    > {
        const subcategories = getMap.subcategory(this.mainEntityIds, [
            'organization',
        ])
        return {
            mainEntity: await subcategories,
        }
    }

    protected async authorize(
        _input: DeleteSubcategoryInput[],
        entityMaps: DeleteEntityMap<Subcategory>
    ) {
        const organizationIds: string[] = []
        for (const c of entityMaps.mainEntity.values()) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await c.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_subjects_20447
        )
    }

    protected async buildOutput(currentEntity: Subcategory): Promise<void> {
        this.output.subcategories.push(
            mapSubcategoryToSubcategoryConnectionNode(currentEntity)
        )
    }
}
