import DataLoader from 'dataloader'
import { SelectQueryBuilder } from 'typeorm'
import { createEntityScope } from '../directives/isAdmin'
import { User } from '../entities/user'
import { UserPermissions } from '../permissions/userPermissions'
import { Lazy } from '../utils/lazyLoading'

export interface IClassLoaders {
    teachers: Lazy<DataLoader<string, User[]>>
    students: Lazy<DataLoader<string, User[]>>
}

/**
 * Keeps only keys of the object which have the 'User_' prefix,
 * but removes the prefix from the keys.
 * @param rawUser raw SQL query result on the 'user' table
 * @returns User type object
 */
function mapToUser(rawUser: Record<string, unknown>): User {
    const user = new User()
    const userTablePrefix = 'User_'
    for (const rawKey in rawUser) {
        if (!rawKey.startsWith(userTablePrefix)) continue
        const key = rawKey.slice(userTablePrefix.length) as keyof User
        user[key] = rawUser[rawKey] as never
    }
    return user
}

export async function usersForClasses(
    classIds: readonly string[],
    permissions: UserPermissions,
    property: keyof Pick<User, 'classesTeaching' | 'classesStudying'>
) {
    const scope = (await createEntityScope({
        permissions,
        entity: 'user',
    })) as SelectQueryBuilder<User>

    const [joinTable, alias] =
        property === 'classesTeaching'
            ? ['user_classes_teaching_class', 'ClassTeaching']
            : ['user_classes_studying_class', 'ClassStudying']

    const rawUsers = await scope
        .distinct(true)
        .addSelect(`${alias}.classClassId`, 'class_id')
        .innerJoin(joinTable, alias, `${alias}.userUserId = User.user_id`)
        .andWhere(`${alias}.classClassId IN (:...class_ids)`, {
            class_ids: classIds,
        })
        .getRawMany()
    const classUsers = new Map<string, User[]>()
    for (const rawUser of rawUsers) {
        const classId = rawUser[`class_id`] as string
        const user = mapToUser(rawUser)
        if (!classUsers.has(classId)) {
            classUsers.set(classId, [user])
        } else {
            classUsers.get(classId)!.push(user)
        }
    }

    return classIds.map((id) => classUsers.get(id) || [])
}
