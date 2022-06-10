import { createUnauthorizedAPIError } from './errors'
import { Entities } from './inputValidation'

/**
 * Checks `ids` against an map and flags an unauthorized error.
 */
export function flagUnauthorized<T extends Entities>(
    entityClass: new () => T,
    ids: string[],
    map: Map<string, T>,
    attribute: keyof T
) {
    for (let x = 0; x < ids.length; x++) {
        const entity = map.get(ids[x])
        if (!entity) continue
        if (entity[attribute]) {
            throw createUnauthorizedAPIError(entityClass.name, ids[x], x)
        }
    }
}
