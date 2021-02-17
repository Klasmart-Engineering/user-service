import { User } from '../entities/user'
import { CursorObject, Paginated, stringable } from './paginated.interface'

export interface userQuery {
    (
        receiver: any,
        user: User,
        cursor: CursorObject<any>,
        id: any,
        direction: boolean,
        staleTotal: boolean,
        limit: number,
        startKey: any,
        endKey: any,
        ids?: string[]
    ): Promise<Paginated<any, stringable>>
}

export interface adminQuery {
    (
        receiver: any,
        cursor: CursorObject<any>,
        id: any,
        direction: boolean,
        staleTotal: boolean,
        limit: number,
        startKey: any,
        endKey: any,
        ids?: string[]
    ): Promise<Paginated<any, stringable>>
}
