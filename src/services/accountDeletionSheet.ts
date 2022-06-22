import { google } from 'googleapis'
import { Lazy } from '../utils/lazyLoading'
import { alphaToNum } from '../utils/stringUtils'

export default {
    deleteRows,
    getAll,
    getHeaders,
    getRange,
    push,
}

// TABLE-SPECIFIC CONSTANTS
export const accountDeletionRequestColumns = {
    guidAzureB2C: 'A',
    guidUserService: 'B',
    hashedUserInfo: 'C',
    deletionRequestDate: 'D',
    overallStatus: 'E',
    userService: 'F',
    yService: 'G',
}
const sheetNumber = '1'
const firstColumn = Object.values(accountDeletionRequestColumns)[0]
const lastColumn = Object.values(accountDeletionRequestColumns).slice(-1)[0]

// TYPE DEFINITIONS
export type AccountDeletionRequestRow = {
    [T in keyof typeof accountDeletionRequestColumns]: string
}

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

async function getAll(fetchRange: Range): Promise<AccountDeletionRequestRow[]> {
    // Fetch all values in the range
    const { startRow, endRow, startColumn, endColumn } = fetchRange
    const sheets = await authenticate.instance
    const range = `Sheet${sheetNumber}!${startColumn}${startRow}:${endColumn}${endRow}`
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        range,
    })
    if (!response.data.values) {
        throw new Error('Failed to retrieve data in that range')
    }

    // Parse values into objects
    const rows: AccountDeletionRequestRow[] = []
    for (const values of response.data.values) {
        const row = {} as AccountDeletionRequestRow
        Object.entries(accountDeletionRequestColumns).forEach(
            ([key, columnName]) => {
                row[key as keyof typeof accountDeletionRequestColumns] =
                    values[alphaToNum(columnName) - 1]
            }
        )
        rows.push(row)
    }
    return rows
}

async function getHeaders(
    tableRange: Pick<Range, 'startRow' | 'startColumn' | 'endColumn'>
): Promise<string[]> {
    const { startRow, startColumn, endColumn } = tableRange
    const sheets = await authenticate.instance
    const range = `Sheet${sheetNumber}!${startColumn}${startRow}:${endColumn}${startRow}`
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

async function push(...rows: AccountDeletionRequestRow[]): Promise<Range> {
    const sheets = await authenticate.instance
    const values = rows.map((row) => Object.values(row))
    const result = await sheets.spreadsheets.values.append({
        range: `Sheet${sheetNumber}!${firstColumn}:${lastColumn}`,
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
    })
    if (!result.data.updates?.updatedRange) {
        throw new Error('Failed to append row to table')
    }
    return parseRange(result.data.updates.updatedRange)
}

// UTILS
const authenticate = new Lazy(async () => {
    const scopes = ['https://www.googleapis.com/auth/spreadsheets']
    const auth = await google.auth.getClient({ scopes })
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
