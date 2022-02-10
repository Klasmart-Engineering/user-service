import { Connection } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Upload } from '../../types/upload'
import { readCSVFile } from './readFile'
import { CustomError, instanceOfCSVError } from '../../types/csv/csvError'
import { UserPermissions } from '../../permissions/userPermissions'
import { CreateEntityHeadersCallback } from '../../types/csv/createEntityHeadersCallback'
import logger from '../../logging'

export async function createEntityFromCsvWithRollBack(
    connection: Connection,
    file: Upload,
    functionsToSaveEntityFromCsvRow: CreateEntityRowCallback[],
    userPermissions: UserPermissions,
    functionToValidateCSVHeaders?: CreateEntityHeadersCallback,
    isDryRun = false
) {
    const queryRunner = connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
        await readCSVFile(
            queryRunner.manager,
            file,
            functionsToSaveEntityFromCsvRow,
            userPermissions,
            functionToValidateCSVHeaders
        )
        logger.debug('Generic Upload CSV File finished')

        if (!isDryRun) {
            await queryRunner.commitTransaction()
        } else {
            await queryRunner.rollbackTransaction()
        }
    } catch (errors) {
        if (isDryRun) {
            logger.warn('Errors found when previewing CSV file: %o', errors)
        } else {
            logger.warn('Error uploading from CSV file: %o', errors)
        }
        await queryRunner.rollbackTransaction()
        if (
            Array.isArray(errors) &&
            errors.every((err) => instanceOfCSVError(err))
        ) {
            throw new CustomError(errors)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error(errors as any)
    } finally {
        await queryRunner.release()
    }
}
