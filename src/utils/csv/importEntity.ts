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
    functionToSaveEntityFromCsvRow: any
) {
    const queryRunner = connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
        await readCSVFile(file, async (row, rowCounter) => {
            row = formatCSVRow(row)
            await functionToSaveEntityFromCsvRow(
                queryRunner.manager,
                row,
                rowCounter
            )
        })
        console.log('Generic Upload CSV File finished')
        await queryRunner.commitTransaction()
    } catch (error) {
        console.log('Error in generic upload CSV file: ', error)
        await queryRunner.rollbackTransaction()
        throw error
    } finally {
        await queryRunner.release()
    }
}
