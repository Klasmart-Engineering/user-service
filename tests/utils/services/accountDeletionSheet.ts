import {
    authenticate,
    Range,
    Row,
    sheetNumber,
    firstColumn,
    lastColumn,
    tableHeaders,
} from '../../../src/services/accountDeletionSheet'

export default {
    deleteRows,
    getAll,
}

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
