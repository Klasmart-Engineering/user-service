import {
    //   stringable,
    //   toCursorHash,
    //   CursorObject,
    DEFAULT_PAGE_SIZE,
    fromCursorHash,
    staleCursorTotal,
    paginateData,
} from './paginated.interface'

const entityCursorInfo = new Map<string, any>()
entityCursorInfo.set('organization', {
    cursorSearchKey: 'Organization.organization_id',
})

entityCursorInfo.set('user', {
    cursorSearchKey: 'User.user_id',
})
entityCursorInfo.set('role', {
    cursorSearchKey: 'Role.role_id',
})

entityCursorInfo.set('class', {
    cursorSearchKey: 'Class.class_id',
})

entityCursorInfo.set('permission', {
    cursorSearchKey: 'Permission.permission_id',
})

export async function getPaginated(
    receiver: any,
    entityName: string,
    { before, after, first, last, scope }: any
) {
    const cursorInfo = entityCursorInfo.get(entityName)

    if (after && !first) {
        first = DEFAULT_PAGE_SIZE
    }
    if (before && !last) {
        last = DEFAULT_PAGE_SIZE
    }
    const cursor = after
        ? fromCursorHash(after)
        : before
        ? fromCursorHash(before)
        : undefined

    const id = cursor?.id
    let timeStamp: number = cursor?.timeStamp || 0
    let count: number = cursor?.total || 0

    const direction = last || before ? (after ? true : false) : true
    if (direction) {
        first = first || DEFAULT_PAGE_SIZE
    } else {
        last = last || DEFAULT_PAGE_SIZE
    }
    const staleTotal = cursor ? staleCursorTotal(cursor) : true

    if (staleTotal) {
        count = await scope.getCount()
        timeStamp = Date.now()
    }

    if (direction) {
        if (after) {
            scope.andWhere(`${cursorInfo?.cursorSearchKey} < :id`, {
                id: id,
            })
        }
        scope.orderBy(cursorInfo?.cursorSearchKey, 'DESC').limit(first + 1)
    } else {
        if (before) {
            scope.andWhere(`${cursorInfo?.cursorSearchKey} > :id`, {
                id: id,
            })
        }
        scope.orderBy(cursorInfo?.cursorSearchKey, 'ASC').limit(last + 1)
    }

    const data = await scope.getMany()
    if (!direction) {
        data.reverse()
    }
    return paginateData<any, string>(
        count,
        timeStamp,
        data,
        true,
        first,
        last,
        direction ? undefined : id,
        direction ? id : undefined
    )
}
