import { APIError, IAPIError } from '../../types/errors/apiError'
import { customErrors } from '../../types/errors/customError'
import { config } from '../../config/config'
import logger from '../../logging'
import newrelic from 'newrelic'
import { IDateRange } from './dateRangeValidation'

export function reportError(
    e: Error,
    customAttributes?: { [key: string]: string | number | boolean }
) {
    logger.error(e)
    if (customAttributes) {
        logger.error(`Error attributes: ${JSON.stringify(customAttributes)}`)
    }
    newrelic.noticeError(e, customAttributes)
}

type entityErrorType =
    | 'nonExistent'
    | 'nonExistentChild'
    | 'inactive'
    | 'unauthorized'
    | 'existent'
    | 'existentChild'

export function createInputLengthAPIError(
    entity: string,
    limit: 'min' | 'max',
    attribute = 'input array',
    index?: number
): APIError {
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
        attribute,
        min: limit === 'min' ? lengthLimitValues[limit].value : undefined,
        max: limit === 'max' ? lengthLimitValues[limit].value : undefined,
        index,
    })
}

export function createNonExistentOrInactiveEntityAPIError(
    index: number,
    variables: string[],
    attribute: string,
    entity: string,
    otherAttribute: string
): APIError {
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

export function createInvalidDateRangeAPIError(
    index: number,
    variables: string[]
): APIError {
    return new APIError({
        code: customErrors.invalid_date_range.code,
        message: customErrors.invalid_date_range.message,
        variables: variables,
        index: index,
    })
}

export function createOverlappingDateRangeAPIError(
    index: number,
    variables: string[],
    entity: string,
    parentEntity: string,
    inputDates: IDateRange,
    overlappedDates: IDateRange,
    parentEntityAttribute: string,
    parentEntityAttributeValue: string
): APIError {
    return new APIError({
        code: customErrors.overlapping_date_range.code,
        message: customErrors.overlapping_date_range.message,
        variables: variables,
        entity: entity,
        parentEntity: parentEntity,
        index: index,
        inputStartDateString: inputDates.startDate.toISOString(),
        inputEndDateString: inputDates.endDate.toISOString(),
        overlappedStartDateString: overlappedDates.startDate.toISOString(),
        overlappedEndDateString: overlappedDates.endDate.toISOString(),
        attribute: parentEntityAttribute,
        attributeValue: parentEntityAttributeValue,
    })
}

export function createDuplicateAttributeAPIError(
    index: number,
    variables: string[],
    entity: string
): APIError {
    return new APIError({
        code: customErrors.duplicate_attribute_values.code,
        message: customErrors.duplicate_attribute_values.message,
        variables,
        entity,
        attribute: `(${variables.toString()})`,
        index,
    })
}

export function createDuplicateInputAttributeAPIError(
    index: number | undefined,
    entity: string,
    entityName: string,
    attribute: string,
    attributeValue: string
): APIError {
    return new APIError({
        code: customErrors.duplicate_input_attribute_value.code,
        message: customErrors.duplicate_input_attribute_value.message,
        variables: ['id'],
        entity,
        entityName,
        attribute,
        attributeValue,
        index,
    })
}

export function createDatabaseSaveAPIError(
    entity: string,
    message: string
): APIError {
    return new APIError({
        code: customErrors.database_save_error.code,
        message: customErrors.database_save_error.message,
        variables: [],
        entity,
        attribute: message,
    })
}

export function createUnauthorizedAPIError(
    entity: string,
    entityName: string,
    index: number
) {
    return new APIError({
        code: customErrors.unauthorized.code,
        message: customErrors.unauthorized.message,
        variables: [],
        entity,
        entityName,
        index,
    })
}

export function createUserAlreadyOwnsOrgAPIError(
    userId: string,
    orgId: string,
    index: number
) {
    return new APIError({
        code: customErrors.user_already_owns_an_organization.code,
        message: customErrors.user_already_owns_an_organization.message,
        variables: [''],
        entityName: userId,
        parentName: orgId,
        index: index,
    })
}

export function createExistentEntityAttributeAPIError(
    entity: string,
    entityName: string,
    attribute: string,
    attributeValue: string,
    index: number
) {
    return new APIError({
        code: customErrors.existent_entity_attribute.code,
        message: customErrors.existent_entity_attribute.message,
        variables: [],
        entity,
        entityName,
        index,
        attribute,
        attributeValue,
    })
}

export function createDuplicateChildEntityAttributeAPIError(
    entity: string,
    entityName: string,
    parentEntity: string,
    parentName: string,
    attribute: string,
    attributeValue: string,
    index: number
) {
    return new APIError({
        code: customErrors.duplicate_child_entity_attribute.code,
        message: customErrors.duplicate_child_entity_attribute.message,
        variables: [],
        entity,
        entityName,
        index,
        attribute,
        attributeValue,
        parentEntity,
        parentName,
    })
}

export function createApplyingChangeToSelfAPIError(
    userId: string,
    index: number
) {
    return new APIError({
        code: customErrors.applying_change_to_self.code,
        message: customErrors.applying_change_to_self.message,
        variables: [],
        entityName: userId,
        index,
    })
}

export function createMustHaveExactlyNAPIError(
    entity: string,
    entityName: string,
    parentEntity: string,
    count: number,
    index: number
) {
    return new APIError({
        code: customErrors.must_have_exactly_n.code,
        message: customErrors.must_have_exactly_n.message,
        variables: [],
        entity,
        entityName,
        parentEntity,
        count,
        index,
    })
}

export function createClassHasAcademicTermAPIError(
    entityName: string,
    index: number
) {
    return new APIError({
        code: customErrors.class_has_academic_term.code,
        message: customErrors.class_has_academic_term.message,
        variables: ['class_id', 'academic_term_id'],
        entityName,
        index,
    })
}

export function createEntityAPIError(
    errorType: entityErrorType,
    index: number | undefined,
    entity: string,
    name?: string,
    parentEntity?: string,
    parentName?: string,
    variables?: string[]
): APIError {
    const errorValues = {
        nonExistent: {
            code: customErrors.nonexistent_entity.code,
            message: customErrors.nonexistent_entity.message,
            variables: ['id'],
        },
        nonExistentChild: {
            code: customErrors.nonexistent_child.code,
            message: customErrors.nonexistent_child.message,
            variables: variables || [''],
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
        existent: {
            code: customErrors.existent_entity.code,
            message: customErrors.existent_entity.message,
            variables: ['name'],
        },
        existentChild: {
            code: customErrors.existent_child_entity.code,
            message: customErrors.existent_child_entity.message,
            variables: variables || [''],
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

    if (
        ['existentChild', 'nonExistentChild', 'overlappingDateRange'].includes(
            errorType
        )
    ) {
        errorDetails.parentEntity = parentEntity
        errorDetails.parentName = parentName
    }

    return new APIError(errorDetails)
}

export function createExistentEntityAttributesAPIError(
    index: number,
    entity: string,
    entityName: string,
    fieldValues: Record<string, string>
) {
    const keys = Object.keys(fieldValues)
    const keyValues = keys.map((k) => {
        return {
            field: k,
            value: fieldValues[k],
        }
    })

    const fields = keyValues.map((kv) => `${kv.field} ${kv.value}`).join(', ')
    return new APIError({
        index,
        entity,
        entityName,
        code: customErrors.existent_entity_attributes.code,
        message: customErrors.existent_entity_attributes.message,
        variables: Object.keys(fieldValues),
        fieldValues: keyValues,
        fields,
    })
}
