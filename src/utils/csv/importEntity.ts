import { Connection } from 'typeorm'
import { readCSVFile } from './readFile'

function formatCSVRow(row: any) {
    const keys = Object.keys(row)
    const formattedValues = Object.values(row).map((value) => {
        return value || null
    })

    keys.forEach((key, index) => {
        Object.assign(row, { [key]: formattedValues[index] })
    })

    return row
}

export async function createEntityFromCsvWithRollBack(
    connection: Connection,
    file: any,
    functionToProcessEntityFromCsvRow: any
) {
    const queryRunner = connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
        if (Array.isArray(functionToProcessEntityFromCsvRow)) {
            for (let functionEntity of functionToProcessEntityFromCsvRow) {
                await readCSVFile(file, async (row, rowCounter) => {
                    row = formatCSVRow(row)
                    await functionEntity(queryRunner.manager, row, rowCounter)
                })
            }
        } else {
            await readCSVFile(file, async (row, rowCounter) => {
                row = formatCSVRow(row)
                await functionToProcessEntityFromCsvRow(
                    queryRunner.manager,
                    row,
                    rowCounter
                )
            })
        }
        console.log('CSV file upload finished')
        await queryRunner.commitTransaction()
    } catch (error) {
        console.log('Error uploading from CSV file: ', error)
        await queryRunner.rollbackTransaction()
        throw error
    } finally {
        await queryRunner.release()
    }
}
