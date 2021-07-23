import Joi from 'joi'

export interface ICsvPropertyValidationDetails {
    entity: string
    attribute: string
    validation: Joi.AnySchema
}

export type CsvRowValidationSchema<Row = Record<string, string>> = Record<
    keyof Row,
    ICsvPropertyValidationDetails
>
