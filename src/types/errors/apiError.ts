import { ApolloError } from 'apollo-server-express'
import Joi, { ValidationResult } from 'joi'
import { getCustomConstraintDetails } from '../../entities/validations/messages'
import { stringInject } from '../../utils/stringUtils'
import { APISchema, APISchemaMetadata } from '../api'
import { BaseError, ErrorParams } from './baseError'

export interface IAPIError extends BaseError, ErrorParams {
    // Can't use `arguments` (GraphQL keyword) as it shadows builtin JS property
    variables: string[]
}

export class APIError extends Error implements IAPIError {
    code: string
    variables: string[]
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
    index?: number
    fields?: string

    constructor(error: IAPIError) {
        const { code, message, variables, ...params } = error
        super()
        this.code = code
        this.variables = variables
        // Must set message explicitly rather than with super(), otherwise it's private
        this.message = formatMessage(message, params)
        Object.assign(this, params)
    }
}

export function formatMessage(
    message: string | undefined,
    params: ErrorParams
): string {
    return message
        ? stringInject(
              params.index !== undefined
                  ? `${apiErrorConstants.MSG_ERR_API_AT_INDEX}, ${message}`
                  : message,
              params
          ) ?? message
        : ''
}

export function joiResultToAPIErrors<APIArguments>(
    result: ValidationResult,
    metadata: APISchemaMetadata<APIArguments> | APIMetadataPlaceHolder
): APIError[] {
    return (
        result?.error?.details.map((error) => {
            const details = getCustomConstraintDetails(error)
            const { code, message, params } = details
            const key = error.context?.key || ''
            const m = metadata as APIMetadataPlaceHolder
            if (m.entity != undefined) {
                return new APIError({
                    code,
                    message,
                    variables: [key],
                    entity: m.entity,
                    attribute: m.attribute ?? key,
                    index: params?.index as number,
                    ...params,
                })
            }
            const mdata = metadata as APISchemaMetadata<APIArguments>
            let meta = mdata?.[key as keyof APIArguments]
            if (meta === undefined) {
                meta = mdata?.['_' as keyof APIArguments]
                if (meta) meta.attribute = key
            }
            return new APIError({
                code,
                message,
                variables: [key],
                entity: meta?.entity,
                attribute: meta?.attribute ?? key,
                index: params?.index as number,
                ...params,
            })
        }) ?? []
    )
}

export const apiErrorConstants = {
    ERR_API_BAD_INPUT: 'ERR_API_BAD_INPUT',
    MSG_ERR_API_AT_INDEX: 'On index {index}',
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

export function validateAPICall<APIArguments>(
    data: APIArguments,
    schema: APISchema<APIArguments>,
    metadata: APISchemaMetadata<APIArguments> | APIMetadataPlaceHolder
) {
    const result = Joi.object(schema).validate(data, {
        abortEarly: false,
    })

    return {
        errors: joiResultToAPIErrors<APIArguments>(result, metadata),
        validData: result.value as Partial<APIArguments>,
    }
}

export interface APIMetadataPlaceHolder {
    entity: string
    attribute?: string
}
