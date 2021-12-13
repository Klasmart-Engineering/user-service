import { EntityManager } from 'typeorm'
import { CSVError } from './csvError'
import { UserPermissions } from '../../permissions/userPermissions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateEntityRowCallback<RowType = any> = (
    manager: EntityManager,
    row: RowType,
    rowCounter: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => Promise<CSVError[]>

// Used for batch validation of a CSV file - replaces legacy row-by-row validation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProcessEntitiesFromCSVRowsBatchValidation<RowType = any> = (
    manager: EntityManager,
    userPermissions: UserPermissions,
    entityRows: RowType[],
    entityRowErrors: CSVError[]
) => Promise<CSVError[]>
