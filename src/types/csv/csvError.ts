import { ApolloError } from 'apollo-server-errors'
import csvErrorConstants from '../../utils/csv/errors/csvErrorConstants'

/**
 * The CSV error structure
 *
 * For example:
 * ```
 * {
 *   "code": "CSV_BAD_FORMAT",
 *   "message": "On row number 4, organization name is required.",
 *   "details": {
 *     "column": "organization_name",
 *     "row": 4,
 *     "original_message": "On row number {row}, {entity} {attribute} is required.",
 *     "entity": "organization",
 *     "attribute": "name",
 *     // other params when necessary
 *   }
 * }
 * ```
 */
export interface CSVError {
    code: string
    message: string
    row: number
    column: string
    [params: string]: any
}

/**
 * Check whether the object is an instance of CSVError or not
 *
 * @param object any
 * @returns boolean
 */
export function instanceOfCSVError(object: any): object is CSVError {
    return true
}

export class CustomError extends ApolloError {
    constructor(errors: CSVError[]) {
        super(csvErrorConstants.ERR_CSV_BAD_INPUT)

        this.errors = errors
    }
    /**
     * An array contains all errors' details
     */
    errors: Array<CSVError>
}
