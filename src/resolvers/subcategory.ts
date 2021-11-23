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
} from '../types/graphQL/subcategory'
import { createInputLengthAPIError } from '../utils/resolvers'
import { config } from '../config/config'

export const deleteSubcategories = async (
    args: { input: DeleteSubcategoryInput[] },
    context: Context
): Promise<SubcategoriesMutationResult> => {
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
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
