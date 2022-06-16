import { google } from 'googleapis'
import { Lazy } from '../utils/lazyLoading'

export default {
    getRowCount,
    readRow,
    readLastRow,
    push,
}

const sheetNumber = '1'
const firstRow = 'A'
const lastRow = 'G'

interface AccountDeletionRequestRow {
    guidAzureB2c: string
    guidUserService: string
    hashedUserInfo: string
    deletionRequestDate: string
    overallStatus: string
    userService: string
    yService: string
}

const authenticate = new Lazy(async () => {
    const scopes = ['https://www.googleapis.com/auth/spreadsheets']
    const auth = await google.auth.getClient({ scopes })
    return google.sheets({ version: 'v4', auth })
})

// METHODS
async function getRowCount() {
    const sheets = await authenticate.instance
    const range = `Sheet${sheetNumber}!A:A`
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        range: range,
    })
    return response.data.values?.length ?? 0
}

async function readRow(
    rowNumber: number
): Promise<AccountDeletionRequestRow | undefined> {
    const sheets = await authenticate.instance
    const range = `Sheet${sheetNumber}!${firstRow}${rowNumber}:${lastRow}${rowNumber}`
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        range: range,
    })
    const row = response.data.values?.[0]
    if (!row) return undefined
    return {
        guidAzureB2c: row[0],
        guidUserService: row[1],
        hashedUserInfo: row[2],
        deletionRequestDate: row[3],
        overallStatus: row[4],
        userService: row[5],
        yService: row[6],
    }
}

async function readLastRow(): Promise<AccountDeletionRequestRow | undefined> {
    const rowCount = await getRowCount()
    if (!rowCount) return undefined
    return readRow(rowCount)
}

async function push(...rows: AccountDeletionRequestRow[]) {
    const sheets = await authenticate.instance
    const values = rows.map((row) => [
        row.guidAzureB2c,
        row.guidUserService,
        row.hashedUserInfo,
        row.deletionRequestDate,
        row.overallStatus,
        row.userService,
        row.yService,
    ])
    const result = await sheets.spreadsheets.values.append({
        range: `Sheet${sheetNumber}!${firstRow}:${lastRow}`,
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
    })
    return result.data.updates
}
