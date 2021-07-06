import { EntityManager } from 'typeorm'
import { CSVError } from './csvError'

export type CreateEntityRowCallback = (
    manager: EntityManager,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chunk: any,
    rowCounter: number,
    fileErrors: CSVError[]
) => void
