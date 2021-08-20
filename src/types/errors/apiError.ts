import { ApolloError } from 'apollo-server-express'
import Joi, { ValidationResult } from 'joi'
import { getCustomConstraintDetails } from '../../entities/validations/messages'
import { stringInject } from '../../utils/stringUtils'
import { BaseError, ErrorParams } from './baseError'

export interface IAPIError extends BaseError, ErrorParams {}

export class APIError extends Error implements IAPIError {
    code: string
    entity?: string
    attribute?: string
    otherAttribute?: string
    organizationName?: string
    entityName?: string
    parentEntity?: string
    parentName?: string
    min?: number
    max?: number
    format?: string

    constructor(error: IAPIError) {
        const { code, message, ...params } = error
        super()
        this.code = code
        // Must set message explicitly rather than with super(), otherwise it's private
        this.message = stringInject(message, params) ?? message
        Object.assign(this, params)
    }
}

export function joiResultToAPIErrors(
    result: ValidationResult,
    defaultParams?: ErrorParams
): APIError[] {
    return (
        result?.error?.details.map((error) => {
            const details = getCustomConstraintDetails(error)
            const { code, message, params } = details
            return new APIError({
                code,
                message,
                ...defaultParams,
                attribute: error.context?.key,
                ...params,
            })
        }) ?? []
    )
}

export const apiErrorConstants = {
    ERR_API_BAD_INPUT: 'ERR_API_BAD_INPUT',
}

export class APIErrorCollection extends ApolloError {
    constructor(errors: APIError[]) {
        super(
            apiErrorConstants.ERR_API_BAD_INPUT,
            apiErrorConstants.ERR_API_BAD_INPUT
        )

        this.errors = errors
    }
    /**
     * An array contains all errors' details
     */
    public errors: Array<APIError>
}

export function validateApiCall(
    data: Record<string, unknown>,
    schema: Joi.PartialSchemaMap<Record<string, unknown>> | undefined,
    defaultParams?: ErrorParams
) {
    const result = Joi.object(schema).validate(data, {
        abortEarly: false,
    })

    return joiResultToAPIErrors(result, defaultParams)
}
