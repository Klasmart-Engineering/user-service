import { EntityManager } from 'typeorm'
import { CSVError } from './csvError'
import { UserPermissions } from '../../permissions/userPermissions'
import { QueryResultCache } from '../../utils/csv/csvUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateEntityRowCallback<RowType = any> = (
    manager: EntityManager,
    row: RowType,
    rowCounter: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions,
    queryResultCache: QueryResultCache
) => Promise<CSVError[]>
