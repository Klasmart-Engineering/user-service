import { getManager, In, getConnection } from 'typeorm'
import { Category } from '../entities/category'
import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import { mapCategoryToCategoryConnectionNode } from '../pagination/categoriesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import {
    CategoriesMutationResult,
    CreateCategoryInput,
    UpdateCategoryInput,
    CategorySubcategory,
    CategoryConnectionNode,
    AddSubcategoriesToCategoryInput,
} from '../types/graphQL/category'
import {
    createDatabaseSaveAPIError,
    createDuplicateInputAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    createInputRequiresAtLeastOne,
    createNonExistentOrInactiveEntityAPIError,
} from '../utils/resolvers'
import { config } from '../config/config'
import { categoryConnectionNodeFields } from '../pagination/categoriesConnection'
import { subcategoryConnectionNodeFields } from '../pagination/subcategoriesConnection'
import { customErrors } from '../types/errors/customError'

interface InputAndOrgRelation {
    id: string
    name?: string
    orgId?: string
}

export async function updateCategories(
    args: { input: UpdateCategoryInput[] },
    context: Pick<Context, 'permissions'>
): Promise<CategoriesMutationResult> {
    // input length validations
    if (args.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('Category', 'min')
    }

    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('Category', 'max')
    }

    const errors: APIError[] = []
    const ids = args.input.map((val) => val.id)
    const subcategoryIds = args.input.map((val) => val.subcategories).flat()
    const categoryNames = args.input.map((val) => val.name)
    const categoryNodes: CategoryConnectionNode[] = []

    // Finding categories by input ids
    const categories = await Category.createQueryBuilder('Category')
        .select([
            ...categoryConnectionNodeFields,
            'Organization.organization_id',
        ])
        .leftJoin('Category.organization', 'Organization')
        .where('Category.id IN (:...ids)', {
            ids,
        })
        .getMany()

    // Finding the categories by input names
    const namedCategories = await Category.createQueryBuilder('Category')
        .select([
            'Category.id',
            'Category.name',
            'Organization.organization_id',
        ])
        .leftJoin('Category.organization', 'Organization')
        .where('Category.name IN (:...categoryNames)', {
            categoryNames,
        })
        .getMany()

    const organizationIds = []
    for (const c of categories) {
        const orgId = (await c.organization)?.organization_id || ''
        organizationIds.push(orgId)
    }

    for (const id of organizationIds) {
        await context.permissions.rejectIfNotAllowed(
            { organization_id: id },
            PermissionName.edit_subjects_20337
        )
    }

    // Preloading
    const preloadedCategoriesByName = new Map()
    for (const nc of namedCategories) {
        const orgId = (await nc.organization)?.organization_id
        preloadedCategoriesByName.set([orgId, nc.name].toString(), nc)
    }

    const preloadedCategoriesById = new Map(categories.map((c) => [c.id, c]))

    const inputsAndOrgRelation: InputAndOrgRelation[] = []
    for (const i of args.input) {
        const orgId = (
            await categories.find((o) => o.id === i.id)?.organization
        )?.organization_id

        inputsAndOrgRelation.push({
            id: i.id,
            name: i.name,
            orgId,
        })
    }

    const preloadedSubcategories = new Map(
        (
            await Subcategory.findByIds(subcategoryIds, {
                where: { status: Status.ACTIVE },
            })
        ).map((i) => [i.id, i])
    )

    // Process inputs
    for (const [index, subArgs] of args.input.entries()) {
        const { id, name, subcategories } = subArgs
        const duplicateInputId = inputsAndOrgRelation.find(
            (i, findIndex) => i.id === id && findIndex < index
        )

        if (duplicateInputId) {
            errors.push(
                createDuplicateInputAPIError(
                    index,
                    ['id'],
                    'UpdateCategoryInput'
                )
            )
        }

        // Category validations
        const category = preloadedCategoriesById.get(id)

        if (!category) {
            errors.push(
                createEntityAPIError('nonExistent', index, 'Category', id)
            )
            continue
        }

        if (category.status === Status.INACTIVE) {
            errors.push(createEntityAPIError('inactive', index, 'Category', id))
        }

        const categoryOrganizationId =
            (await category.organization)?.organization_id || ''

        // name arg validations
        if (name) {
            const categoryFound = preloadedCategoriesByName.get(
                [categoryOrganizationId, name].toString()
            )
            const categoryExist = categoryFound && categoryFound.id !== id

            if (categoryExist) {
                errors.push(
                    createEntityAPIError('duplicate', index, 'Category', name)
                )
            }

            const duplicatedInputName = inputsAndOrgRelation.find(
                (i, findIndex) =>
                    i.id !== id &&
                    i.name === name &&
                    i.orgId === categoryOrganizationId &&
                    findIndex < index
            )

            if (duplicatedInputName) {
                errors.push(
                    createDuplicateInputAPIError(
                        index,
                        ['name'],
                        'UpdateCategoryInput'
                    )
                )
            }

            if (!categoryExist && !duplicatedInputName) {
                category.name = name
            }
        }

        // subcategories arg validations
        if (subcategories) {
            const subcategoriesFound: Subcategory[] = []
            const missingSubcategoryIds: string[] = []

            subcategories.forEach((val) => {
                const subcategory = preloadedSubcategories.get(val)

                if (subcategory) {
                    subcategoriesFound.push(subcategory)
                } else {
                    missingSubcategoryIds.push(val)
                }
            })

            if (missingSubcategoryIds.length) {
                errors.push(
                    createNonExistentOrInactiveEntityAPIError(
                        index,
                        ['id'],
                        'IDs',
                        'Subcategory',
                        missingSubcategoryIds.toString()
                    )
                )
            } else {
                category.subcategories = Promise.resolve(subcategoriesFound)
            }
        }

        if (!name && !subcategories) {
            errors.push(
                createInputRequiresAtLeastOne(index, 'Category', [
                    'name',
                    'subcategories',
                ])
            )
        } else {
            category.updated_at = new Date()
        }

        categoryNodes.push(mapCategoryToCategoryConnectionNode(category))
    }

    if (errors.length) throw new APIErrorCollection(errors)

    try {
        await getManager().save(categories)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw createDatabaseSaveAPIError('Category', message)
    }

    return { categories: categoryNodes }
}

export async function createCategories(
    args: { input: CreateCategoryInput[] },
    context: Pick<Context, 'permissions'>
): Promise<CategoriesMutationResult> {
    // input length validations
    if (args.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE)
        throw createInputLengthAPIError('Category', 'min')
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        throw createInputLengthAPIError('Category', 'max')

    const organizationIds = args.input.map((val) => val.organizationId)
    const subcategoryIds = args.input.map((val) => val.subcategories).flat()
    const categoryNames = args.input.map((val) => val.name)
    const organizationIdsAndNames = args.input.map((val) =>
        [val.organizationId, val.name].toString()
    )

    for (const id of organizationIds) {
        await context.permissions.rejectIfNotAllowed(
            { organization_id: id },
            PermissionName.create_subjects_20227
        )
    }

    // Preloading
    const preloadedOrgs = new Map(
        (
            await Organization.findByIds(organizationIds, {
                where: { status: Status.ACTIVE },
            })
        ).map((i) => [i.organization_id, i])
    )

    const categoriesFound = await Category.find({
        where: {
            name: In(categoryNames),
            status: Status.ACTIVE,
            organization: { organization_id: In(organizationIds) },
        },
        relations: ['organization'],
    })

    const preloadedSubcategories = new Map(
        (
            await Subcategory.findByIds(subcategoryIds, {
                where: { status: Status.ACTIVE },
            })
        ).map((i) => [i.id, i])
    )

    const preloadedCategories = new Map()
    for (const c of categoriesFound) {
        const orgId = (await c.organization)?.organization_id || ''
        preloadedCategories.set([orgId, c.name].toString(), c)
    }

    // Process inputs
    const categories: Category[] = []
    const errors: APIError[] = []

    for (const [index, subArgs] of args.input.entries()) {
        const { name, organizationId, subcategories } = subArgs

        // Organization validation
        const organization = preloadedOrgs.get(organizationId) as Organization

        if (!organization) {
            errors.push(
                createNonExistentOrInactiveEntityAPIError(
                    index,
                    ['organization_id'],
                    'ID',
                    'Organization',
                    organizationId
                )
            )
        }

        // Subcategory validation
        const subcategoriesFound: Subcategory[] = []
        const missingSubcategoryIds: string[] = []

        subcategories?.forEach((val) => {
            const subcategory = preloadedSubcategories.get(val)

            if (subcategory) {
                subcategoriesFound.push(subcategory)
            } else {
                missingSubcategoryIds.push(val)
            }
        })

        if (missingSubcategoryIds.length) {
            errors.push(
                createNonExistentOrInactiveEntityAPIError(
                    index,
                    ['id'],
                    'IDs',
                    'Subcategory',
                    missingSubcategoryIds.toString()
                )
            )
        }

        // Creating category
        const categoriesInputIsDuplicated = organizationIdsAndNames.some(
            (item) =>
                item === [organizationId, name].toString() &&
                organizationIdsAndNames.indexOf(item) < index
        )

        if (categoriesInputIsDuplicated) {
            errors.push(
                createDuplicateInputAPIError(
                    index,
                    ['organizationId', 'name'],
                    'CreateCategoryInput'
                )
            )
        }

        const categoryExist = preloadedCategories.has(
            [organizationId, name].toString()
        )

        if (organization && categoryExist) {
            errors.push(
                createEntityAPIError(
                    'duplicateChild',
                    index,
                    'Category',
                    name,
                    organizationId
                )
            )
        }

        if (errors.length > 0) continue

        const category = new Category()
        category.name = name
        category.organization = Promise.resolve(organization)
        category.subcategories = Promise.resolve(subcategoriesFound)
        categories.push(category)
    }

    if (errors.length > 0) throw new APIErrorCollection(errors)

    try {
        await getManager().save(categories)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw createDatabaseSaveAPIError('Category', message)
    }

    // Build output
    const output = categories.map((c) => mapCategoryToCategoryConnectionNode(c))
    return { categories: output }
}

export async function addSubcategoriesToCategories(
    args: { input: AddSubcategoriesToCategoryInput[] },
    context: Context
): Promise<CategoriesMutationResult> {
    if (args.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE)
        throw createInputLengthAPIError('Category', 'min')
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        throw createInputLengthAPIError('Category', 'max')

    const errors: APIError[] = []
    const categoryIds: string[] = args.input.map((val) => val.categoryId)
    const subcategoryIds: string[] = args.input
        .map((val) => val.subcategoryIds)
        .flat()
    const categoryNodes: CategoryConnectionNode[] = []
    const isAdmin = context.permissions.isAdmin

    const categories: Entity[] = await Category.createQueryBuilder()
        .select([
            ...categoryConnectionNodeFields,
            `Organization.organization_id`,
        ])
        .leftJoin(`Category.organization`, `Organization`)
        .where(`Category.id IN (:...categoryIds)`, {
            categoryIds,
        })
        .getMany()

    const subcategories: Entity[] = await Subcategory.createQueryBuilder()
        .select([
            ...subcategoryConnectionNodeFields,
            `Organization.organization_id`,
        ])
        .leftJoin(`Subcategory.organization`, `Organization`)
        .where(`Subcategory.id IN (:...subcategoryIds)`, {
            subcategoryIds,
        })
        .getMany()

    const organizationsIds = [
        ...categories.map(
            (category) => category.__organization__?.organization_id || ``
        ),
        ...subcategories.map(
            (subcategory) => subcategory.__organization__?.organization_id || ``
        ),
    ]
    const organizationsWhereIsPermitted = await context.permissions.organizationsWhereItIsAllowed(
        organizationsIds,
        PermissionName.edit_subjects_20337
    )

    const allExistentSubcategories: (Entity &
        CategorySubcategory)[] = await getConnection().query(
        `SELECT "categoryId", "subcategoryId",
        id, name, system, status, organization_id 
        FROM category_subcategories_subcategory 
        JOIN subcategory s ON id = "subcategoryId" 
        WHERE "categoryId" IN (${"'" + (categoryIds.join("','") + "'")})`
    )

    const preloadedCategories = new Map(categories.map((i) => [i.id, i]))
    const preloadedSubcategories = new Map(subcategories.map((i) => [i.id, i]))
    const preloadedCategoriesSubcategories = new Map(
        allExistentSubcategories.map((i) => [
            [i.categoryId, i.subcategoryId].toString(),
            i,
        ])
    )
    const categoriesWithExistentSubcategories = new Map<string, Entity[]>(
        categories.map((i) => [i.id, []])
    )
    for (const c of allExistentSubcategories) {
        categoriesWithExistentSubcategories.get(c.categoryId)?.push({
            id: c.id,
            name: c.name,
            system: c.system,
            status: c.status,
        })
    }

    for (const [categoryIndex, subArgs] of args.input.entries()) {
        const { categoryId, subcategoryIds } = subArgs
        const category = preloadedCategories.get(categoryId)
        errors.push(
            ...validateEntity(
                categoryIndex,
                categoryId,
                category,
                'Category',
                organizationsWhereIsPermitted,
                isAdmin
            )
        )
        if (!category) continue

        const existentSubcategories = categoriesWithExistentSubcategories.get(
            categoryId
        )
        const newSubcategories: Subcategory[] = []
        for (const subcategoryId of subcategoryIds) {
            const subcategory = preloadedSubcategories.get(subcategoryId)
            errors.push(
                ...validateEntity(
                    categoryIndex,
                    subcategoryId,
                    subcategory,
                    'Subcategory',
                    organizationsWhereIsPermitted,
                    isAdmin
                )
            )
            if (!subcategory) continue
            errors.push(
                ...extraValidationForSubcategory(
                    categoryIndex,
                    subcategoryId,
                    subcategory,
                    category,
                    preloadedCategoriesSubcategories
                )
            )
            newSubcategories.push(subcategory as Subcategory)
        }

        ;(category as Category).subcategories = Promise.resolve([
            ...(existentSubcategories as Subcategory[]),
            ...newSubcategories,
        ])
        categoryNodes.push(
            mapCategoryToCategoryConnectionNode(category as Category)
        )
    }

    if (errors.length) throw new APIErrorCollection(errors)

    try {
        await getManager().save(categories)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Category',
        })
    }

    return { categories: categoryNodes }
}

interface Entity {
    id: string
    name?: string
    status: Status
    system: boolean
    __organization__?: { organization_id: string }
}

const validateEntity = (
    index: number,
    entityId: string,
    entity: Entity | undefined,
    entityName: string,
    organizationsWhereIsPermitted: string[],
    isAdmin: boolean | undefined
) => {
    const errors: APIError[] = []
    if (!entity) {
        errors.push(
            new APIError({
                code: customErrors.nonexistent_entity.code,
                message: customErrors.nonexistent_entity.message,
                variables: ['id'],
                entity: '',
                entityName: entityId,
                attribute: 'ID',
                otherAttribute: entityId,
                index,
            })
        )
        return errors
    }
    if (entity.status === Status.INACTIVE) {
        errors.push(
            new APIError({
                code: customErrors.inactive_status.code,
                message: customErrors.inactive_status.message,
                variables: ['id'],
                entity: entityName,
                entityName: entity.name,
                attribute: 'ID',
                otherAttribute: entityId,
                index,
            })
        )
    }
    if (entity.system && !isAdmin) {
        errors.push(
            new APIError({
                code: customErrors.unauthorized.code,
                message: customErrors.unauthorized.message,
                variables: ['id'],
                entity: entityName,
                entityName: entity.name,
                attribute: 'ID',
                otherAttribute: entityId,
                index,
            })
        )
    }
    if (!entity.system && !isAdmin) {
        const isAllowedIntheOrg = organizationsWhereIsPermitted.includes(
            entity.__organization__?.organization_id || ``
        )
        if (!isAllowedIntheOrg) {
            errors.push(
                new APIError({
                    code: customErrors.unauthorized.code,
                    message: customErrors.unauthorized.message,
                    variables: ['id'],
                    entity: entityName,
                    entityName: entity.name,
                    attribute: 'ID',
                    otherAttribute: entityId,
                    index,
                })
            )
        }
    }
    return errors
}

const extraValidationForSubcategory = (
    index: number,
    subcategoryId: string,
    subcategory: Entity,
    category: Entity,
    existentCategoriesSubcategories: Map<string, CategorySubcategory>
) => {
    const errors: APIError[] = []
    if (
        !category.system &&
        !subcategory.system &&
        subcategory.__organization__?.organization_id !==
            category.__organization__?.organization_id
    ) {
        errors.push(
            new APIError({
                code: customErrors.unauthorized.code,
                message: customErrors.unauthorized.message,
                variables: ['id'],
                entity: 'Subcategory',
                entityName: subcategory.name,
                attribute: 'ID',
                otherAttribute: subcategoryId,
                index,
            })
        )
    }
    const existentCategorySubcategory = existentCategoriesSubcategories.get(
        [category.id, subcategoryId].toString()
    )
    if (existentCategorySubcategory) {
        errors.push(
            new APIError({
                code: customErrors.duplicate_child_entity.code,
                message: customErrors.duplicate_child_entity.message,
                variables: ['categoryId', 'subcategoryId'],
                entity: 'Category',
                entityName: category.name,
                attribute: 'ID',
                otherAttribute: subcategoryId,
                index,
            })
        )
    }
    return errors
}
