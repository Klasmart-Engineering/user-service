import { google } from 'googleapis'
import { Lazy } from '../utils/lazyLoading'
import { reportError } from '../utils/resolvers/errors'
import { objectToKey } from '../utils/stringUtils'

export default {
    deleteRows,
    getAll,
    getHeaders,
    getRange,
    push,
}

// TABLE FORMATTING
export const tableHeaders = <const>[
    'guidAzureB2C',
    'guidUserService',
    'hashedUserInfo',
    'deletionRequestDate',
    'overallStatus',
    'userService',
    'yService',
]
const sheetNumber = '1'
const firstColumn = 'A'
const lastColumn = 'G'

// TYPE DEFINITIONS
type TableHeader = typeof tableHeaders[number]

export type Row = { [T in TableHeader]: string }

type Range = {
    startRow: number
    endRow: number
    startColumn: string
    endColumn: string
}

// METHODS
async function deleteRows(deleteRange: Pick<Range, 'startRow' | 'endRow'>) {
    const sheets = await authenticate.instance
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        requestBody: {
            includeSpreadsheetInResponse: true,
            requests: [
                {
                    deleteRange: {
                        range: {
                            sheetId: 0, // gid for default Sheet1
                            startRowIndex: deleteRange.startRow - 1, // index is 0-based but row number is 1-based
                            endRowIndex: deleteRange.endRow, // exclusive, so -1 not needed
                        },
                        shiftDimension: 'ROWS',
                    },
                },
            ],
        },
    })
}

async function getAll(
    fetchRange: Pick<Range, 'startRow' | 'endRow'>
): Promise<Row[]> {
    // Fetch all values in the range
    const { startRow, endRow } = fetchRange
    const sheets = await authenticate.instance
    const range = `Sheet${sheetNumber}!${firstColumn}${startRow}:${lastColumn}${endRow}`
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        range,
    })
    if (!response.data.values) {
        throw new Error('Failed to retrieve data in that range')
    }

    // Parse values into objects
    const rows: Row[] = []
    for (const values of response.data.values) {
        const row = {} as Row
        for (const [i, v] of values.entries()) {
            row[tableHeaders[i]] = v
        }
        rows.push(row)
    }
    return rows
}

async function getHeaders({
    startRow: headerRow,
}: Pick<Range, 'startRow'>): Promise<string[]> {
    const sheets = await authenticate.instance
    const range = `Sheet${sheetNumber}!${firstColumn}${headerRow}:${lastColumn}${headerRow}`
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        range,
    })
    if (!response.data.values) {
        throw new Error('Failed to retrieve table headers')
    }
    return response.data.values[0]
}

async function getRange(): Promise<Range> {
    const sheets = await authenticate.instance

    // appending empty row as this will find the last row for us
    // using '.get' instead would mean returning an entire row
    const response = await sheets.spreadsheets.values.append({
        range: `Sheet${sheetNumber}`,
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [] },
    })

    const tableRange = response.data.tableRange
    if (!tableRange) throw new Error('Failed to retrieve table range')
    return parseRange(tableRange)
}

async function push(...rows: Row[]): Promise<Range | undefined> {
    const sheets = await authenticate.instance
    const values = rows.map((row) => Object.values(row))
    let result = undefined
    try {
        result = await sheets.spreadsheets.values.append({
            range: `Sheet${sheetNumber}!${firstColumn}:${lastColumn}`,
            spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        })
    } catch {
        result = undefined
    }
    if (!result?.data.updates?.updatedRange) {
        for (const row of rows) {
            reportError(
                new Error(
                    `Failed to append row to spreadsheet: ${objectToKey(row)}`
                )
            )
        }
        return undefined
    }

    return parseRange(result.data.updates.updatedRange)
}

// UTILS
const authenticate = new Lazy(async () => {
    const scopes = ['https://www.googleapis.com/auth/spreadsheets']
    const credentialsJson =
        process.env.USER_SERVICE_GOOGLE_SHEETS_API_CREDENTIALS
    if (!credentialsJson) {
        throw new Error(
            'Environment variable USER_SERVICE_GOOGLE_SHEETS_API_CREDENTIALS has no value'
        )
    }
    const credentials = JSON.parse(credentialsJson)

    const auth = await google.auth.getClient({ scopes, credentials })
    return google.sheets({ version: 'v4', auth })
})

export function parseRange(tableRange: string): Range {
    const pattern = /^.*!([A-Z]+)(\d+):([A-Z]+)(\d+)$/
    const matchArray = tableRange.match(pattern)
    if (!matchArray || matchArray.length < 5) {
        throw new Error('Failed to parse table range')
    }
    const startRow = parseInt(matchArray[2])
    const endRow = parseInt(matchArray[4])
    const startColumn = matchArray[1]
    const endColumn = matchArray[3]
    return { startColumn, endColumn, startRow, endRow }
}
