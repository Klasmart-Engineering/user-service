import { getManager, In } from 'typeorm'
import { Context } from '../main'
import {
    DeleteClassInput,
    ClassesMutationResult,
    ClassConnectionNode,
} from '../types/graphQL/class'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { Status } from '../entities/status'
import { Class } from '../entities/class'
import { PermissionName } from '../permissions/permissionNames'
import {
    createDuplicateInputAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
} from '../utils/resolvers'
import { mapClassToClassConnectionNode } from '../pagination/classesConnection'
import { config } from '../config/config'

export async function deleteClasses(
    args: { input: DeleteClassInput[] },
    context: Pick<Context, 'permissions'>
): Promise<ClassesMutationResult> {
    // Input length validations
    if (args.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('User', 'min')
    }
    if (args.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
        throw createInputLengthAPIError('User', 'max')
    }

    // Preload Data
    const classIds = args.input.map((val) => val.id)
    const preloadedData = await Class.createQueryBuilder('Class')
        .select(['Class.class_id', 'ClassOrganization.organization_id'])
        .leftJoin('Class.organization', 'ClassOrganization')
        .where('Class.class_id IN (:...classIds)', { classIds })
        .andWhere('Class.status = :status', { status: Status.ACTIVE })
        .getMany()
    const preloadedClasses = new Map(preloadedData.map((c) => [c.class_id, c]))

    // Check Permissions
    const orgIdSet = new Set<string>()
    for (const c of preloadedClasses.values()) {
        const org = await c.organization
        if (org) orgIdSet.add(org.organization_id)
    }
    await context.permissions.rejectIfNotAllowed(
        { organization_ids: [...orgIdSet] },
        PermissionName.delete_class_20444
    )

    // Process Inputs
    const errors: APIError[] = []
    const output: ClassConnectionNode[] = []
    const partialClass = {
        status: Status.INACTIVE,
        deleted_at: new Date(),
    }
    for (const [index, classId] of classIds.entries()) {
        const dbClass = preloadedClasses.get(classId)

        // Validations
        const inputIdIsDuplicate = classIds.some(
            (item, findIndex) => item === classId && findIndex < index
        )
        if (inputIdIsDuplicate) {
            errors.push(
                createDuplicateInputAPIError(index, ['id'], 'DeleteClassInput')
            )
            continue
        }
        if (!dbClass) {
            errors.push(
                createEntityAPIError('inactive', index, 'Class', classId)
            )
            continue
        }

        // Build output
        Object.assign(dbClass, partialClass)
        output.push(mapClassToClassConnectionNode(dbClass))
    }

    if (errors.length > 0) throw new APIErrorCollection(errors)
    try {
        await getManager()
            .createQueryBuilder()
            .update(Class)
            .set(partialClass)
            .where({ class_id: In(classIds) })
            .execute()
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown Error'
        throw new APIError({
            code: customErrors.database_save_error.code,
            message: customErrors.database_save_error.message,
            variables: [message],
            entity: 'Class',
        })
    }

    return { classes: output }
}
