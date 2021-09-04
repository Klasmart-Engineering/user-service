import type Joi from 'joi'
import { ErrorParams } from './errors/baseError'

/**
 * Map Typescript param type to Joi Schema type
 */
type TypedJoiSchema<APIArgument> = APIArgument extends string
    ? Joi.StringSchema
    : APIArgument extends number
    ? Joi.NumberSchema
    : APIArgument extends Date
    ? Joi.DateSchema
    : APIArgument extends boolean
    ? Joi.BooleanSchema
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    APIArgument extends any[]
    ? Joi.ArraySchema
    : // eslint-disable-next-line @typescript-eslint/ban-types
    APIArgument extends Object
    ? Joi.ObjectSchema
    : Joi.AnySchema

/**
 * Map API Variables to a typed Joi Schema
 */
export type APISchema<APIArguments> = {
    [key in keyof Required<APIArguments>]: TypedJoiSchema<
        Required<APIArguments>[key]
    >
}

/**
 * Map API variables to additional APIError parameters
 */
export type APISchemaMetadata<APIArguments> = {
    [key in keyof Required<APIArguments>]: ErrorParams
}
