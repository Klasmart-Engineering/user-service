import { EntityManager } from 'typeorm'

export type CreateEntityRowCallback = (
    manager: EntityManager,
    chunk: any,
    rowCounter: number,
    fileErrors: string[]
) => void
