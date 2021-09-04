import { CSVError } from './csvError'
import { addCsvError } from '../../utils/csv/csvUtils'
import { customErrors } from '../errors/customError'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateEntityHeadersCallback<HeaderType = any> = (
    headers: HeaderType,
    filename: string,
    fileErrors: CSVError[]
) => Promise<void>

class HeaderRequirements {
    uniqueColumns: Set<string>
    requiredColumns: Set<string>
    eitherRequiredColumns: Set<string>[]

    constructor(
        uniqueColumns: Set<string> = new Set(),
        requiredColumns: Set<string> = new Set(),
        eitherRequiredColumns: Set<string>[] = []
    ) {
        this.uniqueColumns = uniqueColumns
        this.requiredColumns = requiredColumns
        this.eitherRequiredColumns = eitherRequiredColumns
    }
}

export class HeaderValidation extends HeaderRequirements {
    public validate(headers: string[], filename: string) {
        const headersSet = new Set(headers)
        const headerErrors: CSVError[] = []
        this.findMissingRequiredColumns(new Set(headers)).forEach((column) => {
            addCsvError(
                headerErrors,
                customErrors.csv_missing_required_column.code,
                0,
                column,
                customErrors.csv_missing_required_column.message,
                {
                    fileName: filename,
                    columnName: column,
                }
            )
        })

        this.findRepeatedUniqueColumns(headers).forEach((column) => {
            addCsvError(
                headerErrors,
                customErrors.csv_duplicate_column.code,
                0,
                column,
                customErrors.csv_duplicate_column.message,
                {
                    fileName: filename,
                    columnName: column,
                }
            )
        })

        this.findMissingEitherRequiredColumns(headersSet).forEach(
            (columnSet) => {
                const columnList = Array.from(columnSet.values())
                addCsvError(
                    headerErrors,
                    customErrors.csv_missing_required_column.code,
                    0,
                    `${columnList[0]} or ${columnList[1]}`,
                    customErrors.csv_missing_required_column.message,
                    {
                        fileName: filename,
                        columnName: `either ${columnList[0]} or ${columnList[1]}`,
                    }
                )
            }
        )

        return headerErrors
    }

    public findRepeatedUniqueColumns(headers: string[]) {
        const uniqueSet: Set<string> = new Set()
        const duplicateColumns: Set<string> = new Set()
        for (const header of headers) {
            if (this.uniqueColumns.has(header)) {
                if (uniqueSet.has(header)) {
                    duplicateColumns.add(header)
                } else {
                    uniqueSet.add(header)
                }
            }
        }
        return duplicateColumns
    }

    public findMissingRequiredColumns(headers: Set<string>) {
        const missingColumns: Set<string> = new Set()
        for (const column of this.requiredColumns) {
            if (!headers.has(column)) {
                missingColumns.add(column)
            }
        }
        return missingColumns
    }

    public findMissingEitherRequiredColumns(headers: Set<string>) {
        const missingEitherColumns: Set<string>[] = []
        for (const columnSet of this.eitherRequiredColumns) {
            let eitherRequired = false
            for (const column of columnSet) {
                if (headers.has(column)) {
                    eitherRequired = true
                }
            }
            if (!eitherRequired) {
                missingEitherColumns.push(columnSet)
            }
        }
        return missingEitherColumns
    }
}
