import { Connection } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Upload } from '../../types/upload'
import { readCSVFile } from './readFile'
import { CustomError } from '../../types/csv/csvError'

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
    } catch (errors) {
        console.error('Error uploading from CSV file: ', errors)
        await queryRunner.rollbackTransaction()
        throw new CustomError(errors)
    } finally {
        await queryRunner.release()
    }
}
