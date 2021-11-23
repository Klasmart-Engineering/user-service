import { getManager, In } from 'typeorm'
import { Category } from '../entities/category'
import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import { mapCategoryToCategoryConnectionNode } from '../pagination/categoriesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import {
    CategoriesMutationResult,
    CreateCategoryInput,
} from '../types/graphQL/category'
import {
    createInputLengthAPIError,
    createNonExistentOrInactiveEntityAPIError,
    createUnauthorizedOrganizationAPIError,
} from '../utils/resolvers'
import { config } from '../config/config'

export async function createCategories(
    args: { input: CreateCategoryInput[] },
    context: Pick<Context, 'permissions'>
): Promise<CategoriesMutationResult> {
    // input length validations
    if (args.input.length === 0) {
        throw createInputLengthAPIError('Category', 'min')
    }

    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('Category', 'max')
    }

    const isAdmin = context.permissions.isAdmin
    const organizationIds = args.input.map((val) => val.organizationId)
    const subcategoryIds = args.input.map((val) => val.subcategories).flat()
    const categoryNames = args.input.map((val) => val.name)
    const organizationIdsAndNames = args.input.map((val) =>
        [val.organizationId, val.name].toString()
    )

    // Checking in which of the organizations the user has permission to create categories
    const organizationsWhereIsAllowed = await context.permissions.organizationsWhereItIsAllowed(
        organizationIds,
        PermissionName.create_subjects_20227
    )

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

        const isAllowedIntheOrg = organizationsWhereIsAllowed.includes(
            organizationId
        )

        if (!isAdmin && !isAllowedIntheOrg) {
            errors.push(
                createUnauthorizedOrganizationAPIError(index, organizationId)
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
                createCategoryDuplicateInputAPIError(
                    index,
                    ['organizationId', 'name'],
                    'CreateCategoryInput',
                    'organizationId and name combination'
                )
            )
        }

        const categoryExist = preloadedCategories.has(
            [organizationId, name].toString()
        )

        if (organization && categoryExist) {
            errors.push(
                createCategoryDuplicateAPIError(index, name, organizationId)
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
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Category',
        })
    }

    // Build output
    const output = categories.map((c) => mapCategoryToCategoryConnectionNode(c))
    return { categories: output }
}

export function createCategoryDuplicateAPIError(
    index: number,
    name?: string,
    orgId?: string
) {
    return new APIError({
        code: customErrors.duplicate_child_entity.code,
        message: customErrors.duplicate_child_entity.message,
        variables: ['organization_id', 'name'],
        entity: 'Category',
        entityName: name,
        parentEntity: 'Organization',
        parentName: orgId,
        index,
    })
}

export function createCategoryDuplicateInputAPIError(
    index: number,
    variables: string[],
    entity: string,
    attribute: string
) {
    return new APIError({
        code: customErrors.duplicate_attribute_values.code,
        message: customErrors.duplicate_attribute_values.message,
        variables,
        entity,
        attribute,
        index,
    })
}
