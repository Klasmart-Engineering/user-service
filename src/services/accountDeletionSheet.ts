import { google } from 'googleapis'
import { Lazy } from '../utils/lazyLoading'

export default {
    getRowCount,
    findRowByColumn,
    push,
    readLastRow,
    readRow,
    readRows,
}

const accountDeletionRequestColumns = {
    guidAzureB2c: 'A',
    guidUserService: 'B',
    hashedUserInfo: 'C',
    deletionRequestDate: 'D',
    overallStatus: 'E',
    userService: 'F',
    yService: 'G',
}

const sheetNumber = '1'
const firstRow = Object.values(accountDeletionRequestColumns)[0]
const lastRow = Object.values(accountDeletionRequestColumns).slice(-1)[0]

type NewAccountDeletionRequestRow = {
    [T in keyof typeof accountDeletionRequestColumns]: string
}

type AccountDeletionRequestRow = {
    rowNumber: number
} & NewAccountDeletionRequestRow

const authenticate = new Lazy(async () => {
    const scopes = ['https://www.googleapis.com/auth/spreadsheets']
    const auth = await google.auth.getClient({ scopes })
    return google.sheets({ version: 'v4', auth })
})

// METHODS
async function getRowCount() {
    const sheets = await authenticate.instance

    // appending empty row as this will find the last row for us
    // using '.get' instead would mean returning an entire row
    const response = await sheets.spreadsheets.values.append({
        range: `Sheet${sheetNumber}!${firstRow}:${lastRow}`,
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [] },
    })

    // pattern matching the returned table range to find the last row in the table (includes header row)
    const pattern = /^.*![A-Z]+\d+:[A-Z]+(\d+)$/
    const numString = response.data.tableRange?.match(pattern)?.[1]
    return numString ? parseInt(numString) : undefined
}

async function findRowByColumn<
    Column extends keyof NewAccountDeletionRequestRow
>(searchValue: AccountDeletionRequestRow[Column], columnName: Column) {
    const sheets = await authenticate.instance
    const rowCount = await getRowCount()
    if (!rowCount) return undefined

    // retrieve all values in the column
    const searchColumn = accountDeletionRequestColumns[columnName]
    const response = await sheets.spreadsheets.values.get({
        range: `Sheet${sheetNumber}!${searchColumn}2:${searchColumn}${rowCount}`,
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
    })

    // get list of row numbers which match the search value
    const rowMatches: number[] = []
    response.data.values?.reduce((acc, val, idx) => {
        if (val[0] === searchValue) acc.push(idx + 1)
        return acc
    }, rowMatches)

    return readRows(...rowMatches)
}

async function push(...rows: NewAccountDeletionRequestRow[]) {
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

async function readLastRow(): Promise<AccountDeletionRequestRow | undefined> {
    const rowNumber = await getRowCount()
    if (!rowNumber) return undefined
    return readRow(rowNumber)
}

async function readRow(rowNumber: number) {
    return (await readRows(rowNumber))?.[0]
}

async function readRows(
    ...rowNumbers: number[]
): Promise<AccountDeletionRequestRow[] | undefined> {
    const sheets = await authenticate.instance

    // retrieve a row for each row number entered
    const ranges = rowNumbers.map(
        (rowNumber: number) =>
            `Sheet${sheetNumber}!${firstRow}${rowNumber}:${lastRow}${rowNumber}`
    )
    const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.ACCOUNT_DELETION_SHEET_ID,
        ranges,
    })

    const rows: AccountDeletionRequestRow[] = []
    if (!response.data.valueRanges) return undefined
    for (const [idx, valueRange] of response.data.valueRanges.entries()) {
        const values = valueRange.values?.[0]
        if (!values) continue
        rows.push({
            rowNumber: rowNumbers[idx],
            guidAzureB2c: values[0],
            guidUserService: values[1],
            hashedUserInfo: values[2],
            deletionRequestDate: values[3],
            overallStatus: values[4],
            userService: values[5],
            yService: values[6],
        })
    }
    return rows
}
