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
    const userTablePrefix = 'User_'
    for (const key in rawUser) {
        if (key.startsWith(userTablePrefix)) {
            rawUser[key.slice(userTablePrefix.length)] = rawUser[key]
        }
        delete rawUser[key]
    }
    return (rawUser as unknown) as User
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

    const alias =
        property === 'classesTeaching' ? 'ClassTeaching' : 'ClassStudying'
    const rawUsers = await scope
        .addSelect(`${alias}.class_id`)
        .innerJoin(`User.${property}`, alias)
        .andWhere(`${alias}.class_id IN (:...class_ids)`, {
            class_ids: classIds,
        })
        .getRawMany()

    const classUsers = new Map<string, User[]>()
    for (const rawUser of rawUsers) {
        const classId = rawUser[`${alias}_class_id`] as string
        const user = mapToUser(rawUser)
        if (!classUsers.has(classId)) {
            classUsers.set(classId, [user])
        } else {
            classUsers.get(classId)!.push(user)
        }
    }
    return classIds.map((id) => [...new Set(classUsers.get(id))] || [])
}
