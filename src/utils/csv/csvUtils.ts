import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { stringInject } from '../stringUtils'

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
function buildCsvError(
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
