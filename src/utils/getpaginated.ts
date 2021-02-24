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
entityCursorInfo.set('organization', {
    startId: START_KEY,
    endId: END_KEY,
    cursorSearchKey: 'Organization.organization_id',
})

entityCursorInfo.set('user', {
    startId: START_KEY,
    endId: END_KEY,
    cursorSearchKey: 'User.user_id',
})
entityCursorInfo.set('role', {
    startId: START_KEY,
    endId: END_KEY,
    cursorSearchKey: 'Role.role_id',
})

entityCursorInfo.set('class', {
    startId: START_KEY,
    endId: END_KEY,
    cursorSearchKey: 'Class.class_id',
})

entityCursorInfo.set('permission', {
    startId: 'zzzzzzzz',
    endId: 'A',
    cursorSearchKey: 'Permission.permission_id',
})

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
            .andWhere(`${cursorInfo?.cursorSearchKey} < :id`, {
                id: id,
            })
            .orderBy(cursorInfo?.cursorSearchKey, 'DESC')
    } else {
        scope
            .andWhere(`${cursorInfo?.cursorSearchKey} > :id`, {
                id: id,
            })
            .orderBy(cursorInfo?.cursorSearchKey, 'ASC')
    }
    scope.limit(limit + 1)

    const data = await scope.getMany()
    if (!direction) {
        data.reverse()
    }
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
