import DataLoader from 'dataloader'
import { OrganizationOwnership } from '../entities/organizationOwnership'
import { UserSummaryNode } from '../types/graphQL/userSummaryNode'

export interface IOrganizationsConnectionLoaders {
    owners?: DataLoader<string, UserSummaryNode[]>
}

export const ownersForOrgs = async (
    organizationIds: readonly string[]
): Promise<UserSummaryNode[][]> => {
    //
    // fetch organization ownerships of all organizations
    // and join on required entities
    //
    const scope = OrganizationOwnership.createQueryBuilder(
        'OrganizationOwnership'
    )
        .select([
            'OrganizationOwnership.organization_id',
            'OrganizationOwnership.user_id',
        ])
        .where('OrganizationOwnership.organization_id IN (:...ids)', {
            ids: organizationIds,
        })

    const ownerships = new Map<string, OrganizationOwnership>(
        (await scope.getMany()).map((ownership) => [
            ownership.organization_id,
            ownership,
        ])
    )

    return organizationIds.map((id) => {
        const ownerUserId = ownerships.get(id)?.user_id
        return ownerUserId ? [{ id: ownerUserId }] : []
    })
}
