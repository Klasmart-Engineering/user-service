import { getManager } from 'typeorm'
import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { Subcategory } from '../entities/subcategory'
import { Context } from '../main'
import {
    mapSubcategoryToSubcategoryConnectionNode,
    subcategoryConnectionNodeFields,
} from '../pagination/subcategoriesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import {
    DeleteSubcategoryInput,
    SubcategoryConnectionNode,
    SubcategoriesMutationResult,
    UpdateSubcategoryInput,
} from '../types/graphQL/subcategory'
import {
    createInputLengthAPIError,
    MAX_MUTATION_INPUT_ARRAY_SIZE,
} from '../utils/resolvers'

export const deleteSubcategories = async (
    args: { input: DeleteSubcategoryInput[] },
    context: Context
): Promise<SubcategoriesMutationResult> => {
    if (args.input.length > MAX_MUTATION_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('Subcategory', 'max')
    }

    const errors: APIError[] = []
    const ids: string[] = args.input.map((val) => val.id).flat()
    const subcategoryNodes: SubcategoryConnectionNode[] = []
    const isAdmin = context.permissions.isAdmin

    const subcategories = await Subcategory.createQueryBuilder()
        .select([
            ...subcategoryConnectionNodeFields,
            ...(['organization_id'] as (keyof Organization)[]).map(
                (field) => `Organization.${field}`
            ),
        ])
        .leftJoin(`Subcategory.organization`, `Organization`)
        .where(`Subcategory.id IN (:...ids)`, {
            ids,
        })
        .getMany()

    const organizationsIds = subcategories.map(
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (subcategory) => (subcategory as any).__organization__?.organization_id
    )
    const organizationsWhereIsPermitted = await context.permissions.organizationsWhereItIsAllowed(
        organizationsIds,
        PermissionName.delete_subjects_20447
    )

    for (const id of ids) {
        const subcategory = subcategories.find((s) => s.id === id)
        if (!subcategory) {
            errors.push(
                new APIError({
                    code: customErrors.nonexistent_entity.code,
                    message: customErrors.nonexistent_entity.message,
                    variables: ['id'],
                    entity: 'Subcategory',
                })
            )
            continue
        }
        if (subcategory.status === Status.INACTIVE) {
            errors.push(
                new APIError({
                    code: customErrors.inactive_status.code,
                    message: customErrors.inactive_status.message,
                    variables: ['id'],
                    entity: 'Subcategory',
                    entityName: subcategory.name,
                })
            )
        }
        if (subcategory.system && !isAdmin) {
            errors.push(
                new APIError({
                    code: customErrors.unauthorized.code,
                    message: customErrors.unauthorized.message,
                    variables: ['id'],
                    entity: 'Subcategory',
                    entityName: subcategory.name,
                })
            )
        }
        if (!subcategory.system && !isAdmin) {
            const isAllowedIntheOrg = organizationsWhereIsPermitted.includes(
                // eslint-disable-next-line  @typescript-eslint/no-explicit-any
                (subcategory as any).__organization__.organization_id
            )
            if (!isAllowedIntheOrg) {
                errors.push(
                    new APIError({
                        code: customErrors.unauthorized.code,
                        message: customErrors.unauthorized.message,
                        variables: ['id'],
                        entity: 'Subcategory',
                        entityName: subcategory.name,
                    })
                )
            }
        }

        subcategory.status = Status.INACTIVE
        subcategory.deleted_at = new Date()
        subcategoryNodes.push(
            mapSubcategoryToSubcategoryConnectionNode(subcategory)
        )
    }

    if (errors.length) throw new APIErrorCollection(errors)

    try {
        await getManager().save(subcategories)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Subcategory',
        })
    }

    return { subcategories: subcategoryNodes }
}

interface InputAndOrgRelation {
    id: string
    name?: string
    orgId?: string
}

type subcategoryErrorType =
    | 'nonExistent'
    | 'inactive'
    | 'unauthorized'
    | 'duplicate'

export async function updateSubcategories(
    args: { input: UpdateSubcategoryInput[] },
    context: Pick<Context, 'permissions'>
): Promise<SubcategoriesMutationResult> {
    // input length validations
    if (args.input.length === 0) {
        throw createInputLengthAPIError('Subcategory', 'min')
    }

    if (args.input.length > MAX_MUTATION_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('Subcategory', 'max')
    }

    const errors: APIError[] = []
    const ids = args.input.map((val) => val.id)
    const subcategoryNames = args.input.map((val) => val.name)
    const subcategoryNodes: SubcategoryConnectionNode[] = []
    const isAdmin = context.permissions.isAdmin

    // Finding subcategories by input ids
    const subcategories = await Subcategory.createQueryBuilder('Subcategory')
        .select([
            ...subcategoryConnectionNodeFields,
            'Organization.organization_id',
        ])
        .leftJoin('Subcategory.organization', 'Organization')
        .where('Subcategory.id IN (:...ids)', {
            ids,
        })
        .getMany()

    // Finding the subcategories by input names
    const namedCategories = await Subcategory.createQueryBuilder('Category')
        .select([
            'Category.id',
            'Category.name',
            'Organization.organization_id',
        ])
        .leftJoin('Category.organization', 'Organization')
        .where('Category.name IN (:...subcategoryNames)', {
            subcategoryNames,
        })
        .getMany()

    const organizationIds = []
    for (const c of subcategories) {
        const orgId = (await c.organization)?.organization_id || ''
        organizationIds.push(orgId)
    }

    // Checking in which of the organizations the user has permission to edit subcategories
    const organizationsWhereIsAllowed = await context.permissions.organizationsWhereItIsAllowed(
        organizationIds,
        PermissionName.edit_subjects_20337
    )

    // Preloading
    const preloadedSubcategoriesByName = new Map()
    for (const nc of namedCategories) {
        const orgId = (await nc.organization)?.organization_id
        preloadedSubcategoriesByName.set([orgId, nc.name].toString(), nc)
    }

    const preloadedSubcategoriesById = new Map(
        subcategories.map((c) => [c.id, c])
    )

    const inputsAndOrgRelation: InputAndOrgRelation[] = []
    for (const i of args.input) {
        const orgId = (
            await subcategories.find((o) => o.id === i.id)?.organization
        )?.organization_id

        inputsAndOrgRelation.push({
            id: i.id,
            name: i.name,
            orgId,
        })
    }

    // Process inputs
    for (const [index, subArgs] of args.input.entries()) {
        const { id, name } = subArgs
        const duplicateInputId = inputsAndOrgRelation.find(
            (i) => i.id === id && inputsAndOrgRelation.indexOf(i) < index
        )

        if (duplicateInputId) {
            errors.push(createUpdateSubcategoryDuplicateInput(index, 'id'))
        }

        // Subcategory validations
        const subcategory = preloadedSubcategoriesById.get(id)

        if (!subcategory) {
            errors.push(createSubcategoryAPIError('nonExistent', index, id))
            continue
        }

        if (subcategory.status === Status.INACTIVE) {
            errors.push(createSubcategoryAPIError('inactive', index, id))
        }

        if (subcategory.system && !isAdmin) {
            errors.push(createSubcategoryAPIError('unauthorized', index, id))
        }

        const categoryOrganizationId =
            (await subcategory.organization)?.organization_id || ''

        if (!subcategory.system && !isAdmin) {
            const isAllowedIntheOrg = organizationsWhereIsAllowed.includes(
                categoryOrganizationId
            )

            if (!isAllowedIntheOrg) {
                errors.push(
                    createSubcategoryAPIError('unauthorized', index, id)
                )
            }
        }

        // name arg validations
        if (name) {
            const categoryFound = preloadedSubcategoriesByName.get(
                [categoryOrganizationId, name].toString()
            )
            const categoryExist = categoryFound && categoryFound.id !== id

            if (categoryExist) {
                errors.push(createSubcategoryAPIError('duplicate', index, name))
            }

            const duplicatedInputName = inputsAndOrgRelation.find(
                (i) =>
                    i.id !== id &&
                    i.name === name &&
                    i.orgId === categoryOrganizationId &&
                    inputsAndOrgRelation.indexOf(i) < index
            )

            if (duplicatedInputName) {
                errors.push(
                    createUpdateSubcategoryDuplicateInput(index, 'name')
                )
            }

            if (!categoryExist && !duplicatedInputName) {
                subcategory.name = name
            }
        }

        subcategory.updated_at = new Date()

        subcategoryNodes.push(
            mapSubcategoryToSubcategoryConnectionNode(subcategory)
        )
    }
    
    if (errors.length) throw new APIErrorCollection(errors)

    try {
        await getManager().save(subcategories)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Category',
        })
    }

    return { subcategories: subcategoryNodes }
}

export function createSubcategoryAPIError(
    errorType: subcategoryErrorType,
    index: number,
    name?: string
) {
    const subcategoryErrorValues = {
        nonExistent: {
            code: customErrors.nonexistent_entity.code,
            message: customErrors.nonexistent_entity.message,
        },
        inactive: {
            code: customErrors.inactive_status.code,
            message: customErrors.inactive_status.message,
        },
        unauthorized: {
            code: customErrors.unauthorized.code,
            message: customErrors.unauthorized.message,
        },
        duplicate: {
            code: customErrors.duplicate_entity.code,
            message: customErrors.duplicate_entity.message,
            variables: ['name'],
        },
    }

    return new APIError({
        code: subcategoryErrorValues[errorType].code,
        message: subcategoryErrorValues[errorType].message,
        variables: errorType === 'duplicate' ? ['name'] : ['id'],
        entity: 'Subcategory',
        entityName: name,
        index,
    })
}

export function createUpdateSubcategoryDuplicateInput(
    index: number,
    attribute: string
) {
    return new APIError({
        code: customErrors.duplicate_attribute_values.code,
        message: customErrors.duplicate_attribute_values.message,
        variables: [attribute],
        entity: 'UpdateCategoryInput',
        attribute,
        index,
    })
}
