import { ApolloError } from "apollo-server-express"
import Joi, { ValidationResult } from "joi"
import { getCustomConstraintDetails } from "../../entities/validations/messages"
import { stringInject } from "../../utils/stringUtils"

export interface apiError {
    code: string
    message: string
    api: string
    entity:string
    attribute: string[]
    [params: string]: unknown
}

export function addApiError(
    fileErrors: apiError[],
    code: string,
    api:string,
    attribute :string[],
    message: string,
    entity:string,
    params: Record<string, unknown> = {}
): void {
    fileErrors.push(buildApiError(code, api, attribute, message, entity, params))
}


function buildApiError(
    code: string,
    api: string,
    attribute: string[],
    message: string,
    entity: string,
    params: Record<string, unknown>
): apiError {
    const apiError: apiError = {
      api,
      code,
      message: stringInject(
            `${message}`,
            { entity, attribute, entityName: params.value }, )!,
      entity,
      attribute,
      ...params,

    }
  return apiError
}

export function joiResultToAPIErrors( result: ValidationResult,
    api: string, entity:string,schema: Joi.PartialSchemaMap<Record<string, unknown>> | undefined,)
    {
    const apiErrors: apiError[] = []
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

export class CustomApiError extends ApolloError {
    constructor(errors: apiError[], message:string) {
        super(message)

        this.errors = errors
    }
    /**
     * An array contains all errors' details
     */
    public errors: Array<apiError>
}


export function validateApiCall(
     api: string,
     dataObject: Record<string, string>,
    schema: Joi.PartialSchemaMap<Record<string, unknown>> | undefined,
    entity: string
) {
    // first create the Joi validation schema

    const result = Joi.object(schema).validate(
         dataObject,
                {
                    abortEarly: false,
                }
            )
        

    return joiResultToAPIErrors(result, api, entity, schema)
}