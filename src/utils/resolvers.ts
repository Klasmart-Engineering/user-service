import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { config } from '../config/config'

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

export function createUnauthorizedOrganizationAPIError(
    index: number,
    organizationId: string
) {
    return new APIError({
        code: customErrors.unauthorized.code,
        message: customErrors.unauthorized.message,
        variables: ['organizationId'],
        entity: 'Organization',
        entityName: organizationId,
        index,
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
