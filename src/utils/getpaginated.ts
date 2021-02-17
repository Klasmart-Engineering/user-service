import {
    stringable,
    toCursorHash,
    CursorObject,
    DEFAULT_PAGE_SIZE,
    fromCursorHash,
    staleCursorTotal,
    START_KEY,
    END_KEY,
    paginateData,
} from './paginated.interface'

const entityCursorInfo = new Map<string, any>()

entityCursorInfo.set('organization', { startId: START_KEY, endId: END_KEY })

export async function getPaginated(
    receiver: any,
    entityName: string,
    { before, after, first, last, scope }: any
) {
    const cursorInfo = entityCursorInfo.get(entityName)
    const startCursor = toCursorHash(
        new CursorObject<stringable>(cursorInfo?.startId)
    )
    const endCursor = toCursorHash(
        new CursorObject<stringable>(cursorInfo?.endId)
    )

    if (!after && !before) {
        if (first !== undefined) {
            after = startCursor
        } else {
            if (last !== undefined) {
                before = endCursor
            }
        }
        if (!after && !before) {
            after = startCursor
        }
    }
    if (!last) last = DEFAULT_PAGE_SIZE
    if (!first) first = DEFAULT_PAGE_SIZE

    const cursor = after
        ? fromCursorHash(after)
        : before
        ? fromCursorHash(before)
        : fromCursorHash(endCursor)

    const id = cursor.id
    let timeStamp: number = cursor.timeStamp || 0
    let count: number = cursor.total || 0
    const limit = after ? first : last
    const direction = after ? true : false
    const staleTotal = staleCursorTotal(cursor)

    if (staleTotal) {
        count = await scope.getCount()
        timeStamp = Date.now()
    }

    if (direction) {
        scope
            .andWhere('Organization.organization_id < :id', {
                id: id,
            })
            .orderBy('Organization.organization_id', 'DESC')
    } else {
        scope
            .andWhere('Organization.organization_id > :id', {
                id: id,
            })
            .orderBy('Organization.organization_id', 'ASC')
    }
    scope.limit(limit + 1)

    const data = await scope.getMany()

    return paginateData<any, string>(
        count,
        timeStamp,
        data,
        true,
        limit,
        cursorInfo?.startId,
        cursorInfo?.endId,
        direction ? undefined : id,
        direction ? id : undefined
    )
}
