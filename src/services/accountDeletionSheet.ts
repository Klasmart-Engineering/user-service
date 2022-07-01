import { expect } from 'chai'
import { google } from 'googleapis'
import _ from 'lodash'
import { Lazy } from '../utils/lazyLoading'
import { reportError } from '../utils/resolvers/errors'

export default { push }

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
export const sheetNumber = '1'
export const firstColumn = 'A'
export const lastColumn = 'G'

// TYPE DEFINITIONS
type TableHeader = typeof tableHeaders[number]

export type Row = { [T in TableHeader]: string }

export type Range = {
    startRow: number
    endRow: number
    startColumn: string
    endColumn: string
}

// METHODS
async function push(...rows: Row[]): Promise<Range | undefined> {
    const sheets = await authenticate.instance
    const values = rows.map((row) => Object.values(row))

    const result = await validateHeaders(Array.from(tableHeaders))
        .then(() =>
            sheets.spreadsheets.values.append({
                range: `Sheet${sheetNumber}!${firstColumn}:${lastColumn}`,
                spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values },
            })
        )
        .catch((error) => {
            reportError(error)
            return undefined
        })

    if (!result?.data.updates?.updatedRange) {
        for (const row of rows) {
            reportError(new Error(`Failed to append row to spreadsheet`), row)
        }
        return undefined
    }

    return parseRange(result.data.updates.updatedRange)
}

// UTILS
export const authenticate = new Lazy(async () => {
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

async function validateHeaders(expectedHeaders: string[]) {
    const tableRange = await getRange()
    const headers = (await getHeaders(tableRange)).map(_.camelCase)
    expect(headers).to.deep.equal(expectedHeaders)
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
