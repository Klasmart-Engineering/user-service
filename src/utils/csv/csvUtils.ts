import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { stringInject } from '../stringUtils'
import Joi, { ValidationResult } from 'joi'
import { getCustomConstraintDetails } from '../../entities/validations/messages'
import { CsvRowValidationSchema } from './validations/types'

export function addCsvError(
    fileErrors: CSVError[],
    code: string,
    row: number,
    column: string,
    message: string,
    params: Record<string, unknown> = {}
): void {
    fileErrors.push(buildCsvError(code, row, column, message, params))
}

/**
 * Build CSV error
 *
 * @param code      string
 * @param row       number
 * @param column    string
 * @param message   string
 * @param params    Record<string, any>
 *
 * @returns CSVError
 */
export function buildCsvError(
    code: string,
    row: number,
    column: string,
    message: string,
    params: Record<string, unknown>
): CSVError {
    const csvError: CSVError = {
        code: code,
        message: stringInject(
            `${csvErrorConstants.MSG_ERR_CSV_AT_ROW}, ${message}`,
            { ...params, row }
        )!,
        row,
        column,
        ...params,
    }

    return csvError
}

// Applies the validation rules from the schema to the input row
// and produces an array of CSVError
export function validateRow<Row>(
    row: Row,
    rowNumber: number,
    schema: CsvRowValidationSchema<Row>
) {
    // first create the Joi validation schema
    const validationSchema: Partial<Record<keyof Row, Joi.AnySchema>> = {}
    for (const prop in schema) {
        validationSchema[prop] = schema[prop].validation
    }

    const result = Joi.object(validationSchema).validate(row, {
        abortEarly: false,
    })

    return joiResultToCSVErrors(result, rowNumber, schema)
}

// Converts a result from a Joi validation to an array of CSVError
export function joiResultToCSVErrors(
    result: ValidationResult,
    row: number,
    schema: CsvRowValidationSchema
) {
    const csvErrors: CSVError[] = []
    for (const error of result?.error?.details || []) {
        const prop = error.context?.key || ''
        const propDetails = schema[prop]
        const details = getCustomConstraintDetails(error)
        const csvError = buildCsvError(
            details.code,
            row,
            prop,
            details.message,
            {
                entity: propDetails.entity,
                attribute: propDetails.attribute,
                ...error.context,
                ...details?.params,
            }
        )
        csvErrors.push(csvError)
    }
    return csvErrors
}
