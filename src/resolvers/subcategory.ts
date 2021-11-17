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
import { MAX_MUTATION_INPUT_ARRAY_SIZE } from './organization'

export const deleteSubcategories = async (
    args: { input: DeleteSubcategoryInput[] },
    context: Context
): Promise<SubcategoriesMutationResult> => {
    if (args.input.length > MAX_MUTATION_INPUT_ARRAY_SIZE)
        throw new Error(
            `${args.input.length} is larger than the limit of ${MAX_MUTATION_INPUT_ARRAY_SIZE} on mutation input arrays`
        )

    const errors: APIError[] = []
    const ids: string[] = args.input.map((val) => val.id).flat()
    const subcategoryNodes: SubcategoryConnectionNode[] = []
    const isAdmin = context.permissions.isAdmin
    const userId = context.permissions.getUserId()

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

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const organizationsIds = subcategories.map(
        (subcategory) => (subcategory as any).__organization__?.organization_id
    )
    const organizationsWhereIsPermitted = await context.permissions.isAllowedInOrganizations(
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
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
            const isAllowedIntheOrg = organizationsWhereIsPermitted.includes(
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
        const err = e instanceof Error ? e.message : 'Unknown Error'
        throw new Error(
            `DeleteSubcategoriesInput: Error occurred during save. Error: ${err}`
        )
    }

    return { subcategories: subcategoryNodes }
}
