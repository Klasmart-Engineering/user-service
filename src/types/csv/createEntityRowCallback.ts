import { EntityManager } from 'typeorm'
import { CSVError } from './csvError'

export type CreateEntityRowCallback = (
    manager: EntityManager,
    chunk: any,
    rowCounter: number,
    fileErrors: CSVError[]
) => void
