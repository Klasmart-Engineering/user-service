import { Connection } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Upload } from '../../types/upload'
import { readCSVFile } from './readFile'

export async function createEntityFromCsvWithRollBack(
    connection: Connection,
    file: Upload,
    functionsToSaveEntityFromCsvRow: CreateEntityRowCallback[]
) {
    const queryRunner = connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
        await readCSVFile(
            queryRunner.manager,
            file,
            functionsToSaveEntityFromCsvRow
        )
        console.log('Generic Upload CSV File finished')
        await queryRunner.commitTransaction()
    } catch (errorMessage) {
        console.error('Error uploading from CSV file: ', errorMessage)
        await queryRunner.rollbackTransaction()
        throw new Error(errorMessage)
    } finally {
        await queryRunner.release()
    }
}
