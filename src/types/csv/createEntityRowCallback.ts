import { EntityManager } from 'typeorm'
import { UserPermissions } from '../../permissions/userPermissions'
import { CSVError } from './csvError'

export type CreateEntityRowCallback = (
    manager: EntityManager,
    chunk: any,
    rowCounter: number,
    fileErrors: CSVError[],
    permissions?: UserPermissions
) => void
