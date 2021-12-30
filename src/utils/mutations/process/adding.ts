import { CustomBaseEntity } from '../../../entities/customBaseEntity'
import { EntityMap } from '../commonStructure'

export const processAdding = <
    MainEntity extends CustomBaseEntity,
    Subitems extends keyof MainEntity,
    SubEntity extends CustomBaseEntity
>(
    currentEntity: MainEntity,
    subitems: Subitems,
    itemId: string,
    subitemIds: string[],
    maps: EntityMap<MainEntity>
): MainEntity[] => {
    const newSubitems: SubEntity[] = []
    for (const subitemId of subitemIds) {
        const subitem = maps.subitems.get(subitemId) as SubEntity
        newSubitems.push(subitem)
    }
    const preexistentSubitems = maps.itemsWithExistentSubitems.get(itemId)
    currentEntity[subitems] = (Promise.resolve([
        ...(preexistentSubitems as SubEntity[]),
        ...newSubitems,
    ]) as unknown) as SubEntity[] & MainEntity[Subitems]
    return [currentEntity]
}
