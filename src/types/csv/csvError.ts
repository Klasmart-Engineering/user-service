/**
 * The CSV error structure
 *
 * For example:
 * ```
 * {
 *   "code": "CSV_BAD_FORMAT",
 *   "details": {
 *     "column": "organization_name",
 *     "row": 4,
 *     "message": "On row number {row}, {entity} {attribute} is required.",
 *     "entity": "organization",
 *     "attribute": "name",
 *     // other params when necessary
 *   }
 * }
 * ```
 */
export interface CSVError {
    code: string,
    details: {
        row: number,
        column: string,
        message: string,
        [params: string]: any,
    }
}
