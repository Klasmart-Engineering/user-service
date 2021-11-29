import { APIError, IAPIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { config } from '../config/config'

type entityErrorType =
    | 'nonExistent'
    | 'inactive'
    | 'unauthorized'
    | 'duplicate'
    | 'duplicateChild'

export function createInputLengthAPIError(
    entity: string,
    limit: 'min' | 'max'
) {
    const lengthLimitValues = {
        min: {
            code: customErrors.invalid_array_min_length.code,
            message: customErrors.invalid_array_min_length.message,
            value: 1,
        },
        max: {
            code: customErrors.invalid_array_max_length.code,
            message: customErrors.invalid_array_max_length.message,
            value: config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE,
        },
    }

    return new APIError({
        code: lengthLimitValues[limit].code,
        message: lengthLimitValues[limit].message,
        variables: [],
        entity,
        attribute: 'input array',
        min: limit === 'min' ? lengthLimitValues[limit].value : undefined,
        max: limit === 'max' ? lengthLimitValues[limit].value : undefined,
    })
}

export function createNonExistentOrInactiveEntityAPIError(
    index: number,
    variables: string[],
    attribute: string,
    entity: string,
    otherAttribute: string
) {
    return new APIError({
        code: customErrors.nonexistent_or_inactive.code,
        message: customErrors.nonexistent_or_inactive.message,
        variables,
        entity,
        attribute,
        otherAttribute,
        index,
    })
}

export function createInputRequiresAtLeastOne(
    index: number,
    entity: string,
    variables: string[]
) {
    return new APIError({
        code: customErrors.requires_at_least_one.code,
        message: customErrors.requires_at_least_one.message,
        variables,
        entity,
        attribute: 'input array',
        fields: variables.toString(),
        index,
    })
}

export function createDuplicateInputAPIError(
    index: number,
    variables: string[],
    entity: string
) {
    return new APIError({
        code: customErrors.duplicate_attribute_values.code,
        message: customErrors.duplicate_attribute_values.message,
        variables,
        entity,
        attribute: `(${variables.toString()})`,
        index,
    })
}

export function createDatabaseSaveAPIError(entity: string, message: string) {
    new APIError({
        code: customErrors.database_save_error.code,
        message: customErrors.database_save_error.message,
        variables: [message],
        entity,
    })
}

export function createUnauthorizedAPIError(
    entity: string,
    attribute: string,
    entityName?: string
) {
    return new APIError({
        code: customErrors.unauthorized.code,
        message: customErrors.unauthorized.message,
        variables: [attribute],
        entity: entity,
        entityName: entityName,
        index: 0,
    })
}

export function createEntityAPIError(
    errorType: entityErrorType,
    index: number,
    entity: string,
    name?: string,
    orgId?: string
) {
    const errorValues = {
        nonExistent: {
            code: customErrors.nonexistent_entity.code,
            message: customErrors.nonexistent_entity.message,
            variables: ['id'],
        },
        inactive: {
            code: customErrors.inactive_status.code,
            message: customErrors.inactive_status.message,
            variables: ['id'],
        },
        unauthorized: {
            code: customErrors.unauthorized.code,
            message: customErrors.unauthorized.message,
            variables: ['id'],
        },
        duplicate: {
            code: customErrors.duplicate_entity.code,
            message: customErrors.duplicate_entity.message,
            variables: ['name'],
        },
        duplicateChild: {
            code: customErrors.duplicate_child_entity.code,
            message: customErrors.duplicate_child_entity.message,
            variables: ['organization_id', 'name'],
        },
    }

    const errorDetails: IAPIError = {
        code: errorValues[errorType].code,
        message: errorValues[errorType].message,
        variables: errorValues[errorType].variables,
        entity,
        entityName: name,
        index,
    }

    if (errorType === 'duplicateChild') {
        errorDetails.parentEntity = 'Organization'
        errorDetails.parentName = orgId
    }

    return new APIError(errorDetails)
}

// TODO: standardise error handling for permissions
