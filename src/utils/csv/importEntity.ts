import { Connection } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Upload } from '../../types/upload'
import { readCSVFile } from './readFile'
import { CustomError, instanceOfCSVError } from '../../types/csv/csvError'
import { UserPermissions } from '../../permissions/userPermissions'

export async function createEntityFromCsvWithRollBack(
    connection: Connection,
    file: Upload,
    functionsToSaveEntityFromCsvRow: CreateEntityRowCallback[],
    userPermissions: UserPermissions
) {
    const queryRunner = connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
        await readCSVFile(
            queryRunner.manager,
            file,
            functionsToSaveEntityFromCsvRow,
            userPermissions
        )
        console.log('Generic Upload CSV File finished')
        await queryRunner.commitTransaction()
    } catch (errors) {
        console.error('Error uploading from CSV file: ', errors)
        await queryRunner.rollbackTransaction()
        if (
            Array.isArray(errors) &&
            errors.every((err) => instanceOfCSVError(err))
        ) {
            throw new CustomError(errors)
        }
        throw new Error(errors)
    } finally {
        await queryRunner.release()
    }
}
