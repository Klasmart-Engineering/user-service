import { CustomBaseEntity } from '../../../entities/customBaseEntity'
import { APIError } from '../../../types/errors/apiError'
import { createEntityAPIError, getMembershipMapKey } from '../../resolvers'
import { EntityMap } from '../commonStructure'

export const validateAddingRemove = <
    MainEntity extends CustomBaseEntity,
    MainEntityNameKey extends keyof MainEntity,
    SubEntity extends CustomBaseEntity,
    SubEntityNameKey extends keyof SubEntity
>(
    index: number,
    currentEntity: MainEntity,
    mainEntityName: string,
    subEntityName: string,
    mainEntityNameKey: MainEntityNameKey,
    subEntityNameKey: SubEntityNameKey,
    inputTypeName: string,
    itemId: string,
    subitemIds: string[],
    maps: EntityMap<MainEntity>
): APIError[] => {
    const errors: APIError[] = []

    for (const subitemId of subitemIds) {
        const subitem = maps.subitems.get(subitemId) as SubEntity
        if (!subitem) {
            errors.push(
                createEntityAPIError(
                    'nonExistent',
                    index,
                    subEntityName,
                    subitemId
                )
            )
        }
        if (!subitem) continue

        const mutationType = inputTypeName.startsWith('Add') ? 'Add' : 'Remove'
        const itemHasSubitem = maps.itemsSubitems.has(
            getMembershipMapKey(itemId, subitemId)
        )

        if (mutationType === 'Add' && itemHasSubitem) {
            errors.push(
                createEntityAPIError(
                    'duplicateChild',
                    index,
                    subEntityName,
                    (subitem[subEntityNameKey] as unknown) as string,
                    mainEntityName,
                    (currentEntity[mainEntityNameKey] as unknown) as string
                )
            )
        }
        if (mutationType === 'Remove' && !itemHasSubitem) {
            errors.push(
                createEntityAPIError(
                    'nonExistentChild',
                    index,
                    subEntityName,
                    (subitem[subEntityNameKey] as unknown) as string,
                    mainEntityName,
                    (currentEntity[mainEntityNameKey] as unknown) as string
                )
            )
        }
    }
    return errors
}
