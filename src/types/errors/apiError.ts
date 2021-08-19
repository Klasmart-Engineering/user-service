import { ApolloError } from 'apollo-server-express'
import Joi, { ValidationResult } from 'joi'
import { getCustomConstraintDetails } from '../../entities/validations/messages'
import { stringInject } from '../../utils/stringUtils'

export interface APIError {
    code: string
    message: string
    api: string
    entity: string
    attribute: string[]
    [params: string]: unknown
}

export function addApiError(
    errors: APIError[],
    code: string,
    api: string,
    attribute: string[],
    message: string,
    entity: string,
    params: Record<string, unknown> = {}
): void {
    errors.push(
        buildApiError(code, api, attribute, message, entity, params)
    )
}

function buildApiError(
    code: string,
    api: string,
    attribute: string[],
    message: string,
    entity: string,
    params: Record<string, unknown>
): APIError {
    const apiError: APIError = {
        api,
        code,
        message: stringInject(`${message}`, {
            entity,
            attribute,
            entityName: params.value,
        })!,
        entity,
        attribute,
        ...params,
    }
    return apiError
}

export function joiResultToAPIErrors(
    result: ValidationResult,
    api: string,
    entity: string,
    schema: Joi.PartialSchemaMap<Record<string, unknown>> | undefined
) {
    const apiErrors: APIError[] = []
    for (const error of result?.error?.details || []) {
        const prop = error.context?.key || ''
        const details = getCustomConstraintDetails(error)
        const apiError = buildApiError(
            details.code,
            api,
            [prop],
            details.message,
            entity,
            {
                ...error.context,
                ...details?.params,
            }
        )
        apiErrors.push(apiError)
    }
    return apiErrors
}

export class CustomAPIError extends ApolloError {
    constructor(errors: APIError[], message: string) {
        super(message)

        this.errors = errors
    }
    /**
     * An array contains all errors' details
     */
    public errors: Array<APIError>
}

export function validateApiCall(
    api: string,
    dataObject: Record<string, unknown>,
    schema: Joi.PartialSchemaMap<Record<string, unknown>> | undefined,
    entity: string
) {
    // first create the Joi validation schema

    const result = Joi.object(schema).validate(dataObject, {
        abortEarly: false,
    })

    return joiResultToAPIErrors(result, api, entity, schema)
}
