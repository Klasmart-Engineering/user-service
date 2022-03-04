import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { stringInject } from '../stringUtils'
import Joi, { ValidationResult } from 'joi'
import { getCustomConstraintDetails } from '../../entities/validations/messages'
import { CsvRowValidationSchema } from './validations/types'
import { Organization } from '../../entities/organization'
import { Role } from '../../entities/role'
import { School } from '../../entities/school'
import { Class } from '../../entities/class'

export function addCsvError(
    errors: CSVError[],
    code: string,
    row: number,
    column: string,
    message: string,
    // TODO use `CSVErrorParams` here for params typechecking
    params: Record<string, unknown> = {}
): void {
    errors.push(buildCsvError(code, row, column, message, params))
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
        validationSchema[prop] = schema[prop]?.validation
    }

    const result = Joi.object(validationSchema).validate(row, {
        abortEarly: false,
        allowUnknown: true,
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
        // Remove PII
        if (
            error.context?.key?.match(
                /username|given_name|family_name|email|phone/g
            )
        ) {
            delete error.context.value
        }
        const details = getCustomConstraintDetails(error)
        const csvError = buildCsvError(
            details.code,
            row,
            prop,
            details.message,
            {
                entity: propDetails?.entity,
                attribute: propDetails?.attribute,
                ...error.context,
                ...details?.params,
            }
        )
        csvErrors.push(csvError)
    }
    return csvErrors
}

// Map format: entity name in CSV (identifier) -> corresponding entity
export class QueryResultCache {
    validatedOrgs: Map<string, Organization>
    validatedOrgRoles: Map<string, Role>
    validatedSchools: Map<string, School>
    validatedClasses: Map<string, Class>

    constructor() {
        this.validatedOrgs = new Map<string, Organization>()
        this.validatedOrgRoles = new Map<string, Role>()
        this.validatedSchools = new Map<string, School>() // Composite key: JSON-stringified {school_name, org_ID}
        this.validatedClasses = new Map<string, Class>() // Composite key: JSON-stringified {cls_name, school_name, org_ID}
    }
}
