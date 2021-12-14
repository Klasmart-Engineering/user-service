import { EntityManager } from 'typeorm'
import { CSVError } from './csvError'
import { UserPermissions } from '../../permissions/userPermissions'
import { EntityRow as EntityRowType } from './entityRow'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateEntityRowCallback<RowType = any> = (
    manager: EntityManager,
    row: RowType,
    rowCounter: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => Promise<CSVError[]>

// Used for batch validation of a CSV file - replaces legacy row-by-row validation
export type ProcessEntitiesFromCSVRowsBatchValidation<
    RowType = EntityRowType
> = (
    manager: EntityManager,
    userPermissions: UserPermissions,
    entityRows: RowType[],
    entityRowErrors: CSVError[]
) => Promise<CSVError[]>
