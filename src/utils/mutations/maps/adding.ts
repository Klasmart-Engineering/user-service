import { EntityTarget, getConnection } from 'typeorm'
import { CustomBaseEntity } from '../../../entities/customBaseEntity'
import { Organization } from '../../../entities/organization'
import { Status } from '../../../entities/status'
import { getMembershipMapKey } from '../../resolvers'
import { EntityMap } from '../commonStructure'

export async function generateMapsForAdding<
    Input,
    AddingIds extends keyof Input,
    Mainitem extends CustomBaseEntity,
    MainitemId extends keyof Mainitem,
    subitems extends keyof Mainitem,
    Subitem extends CustomBaseEntity,
    SubitemId extends keyof Subitem
>(
    mainitemEntity: EntityTarget<Mainitem>,
    mainitemId: MainitemId,
    organizationItems: string,
    rels: subitems,
    itemIds: string[],
    input: Input[],
    addingIds: AddingIds,
    relations: string,
    subitemEntity: EntityTarget<Subitem>,
    subitemId: SubitemId
): Promise<EntityMap<Mainitem>> {
    const connection = getConnection()
    const mainEntityMetadata = connection.getMetadata(mainitemEntity)
    const mainitemRepository = connection.getRepository(mainitemEntity)
    const preloadedItemArray = mainitemRepository.findByIds(itemIds, {
        where: { status: Status.ACTIVE },
        relations: [relations],
    })
    const repository = connection.getRepository(subitemEntity)
    const preloadedSubitemsArray = repository.findByIds(
        input.map((val) => val[addingIds]).flat(),
        { where: { status: Status.ACTIVE } }
    )
    const itemsWithExistentSubitems = new Map<string, Subitem[]>()
    const itemsSubitems = new Map<string, Subitem>()
    for (const item of await preloadedItemArray) {
        // eslint-disable-next-line no-await-in-loop
        const subitems =
            (await ((item[rels] as unknown) as Promise<Subitem[]>)) || []
        itemsWithExistentSubitems.set(
            (item[mainitemId] as unknown) as string,
            subitems
        )
        if (subitems.length > 0) {
            for (const cls of subitems) {
                itemsSubitems.set(
                    getMembershipMapKey(
                        (item[mainitemId] as unknown) as string,
                        (cls[subitemId] as unknown) as string
                    ),
                    cls
                )
            }
        }
    }

    const preloadedOrganizationArray = Organization.createQueryBuilder()
        .select('Organization.organization_id')
        .innerJoin(`Organization.${organizationItems}`, mainEntityMetadata.name)
        .where(
            `"${mainEntityMetadata.name}"."${mainitemId}" IN (:...itemIds)`,
            {
                itemIds,
            }
        )
        .getMany()

    return {
        mainEntity: new Map(
            (await preloadedItemArray).map(
                (i) => ([i[mainitemId], i] as unknown) as [string, Mainitem]
            )
        ),
        subitems: new Map(
            (await preloadedSubitemsArray).map(
                (i) =>
                    ([i[subitemId], i] as unknown) as [string, CustomBaseEntity]
            )
        ),
        itemsSubitems,
        itemsWithExistentSubitems,
        organizations: new Map(
            (await preloadedOrganizationArray).map((i) => [
                i.organization_id,
                i,
            ])
        ),
    }
}
