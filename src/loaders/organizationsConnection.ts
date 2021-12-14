import DataLoader from 'dataloader'
import { OrganizationOwnership } from '../entities/organizationOwnership'
import { UserSummaryNode } from '../types/graphQL/user'
import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { Organization } from '../entities/organization'
import { CoreOrganizationConnectionNode } from '../pagination/organizationsConnection'

export interface IOrganizationsConnectionLoaders {
    owners: Lazy<DataLoader<string, UserSummaryNode[]>>
}

export interface IOrganizationNodeDataLoaders {
    node: Lazy<NodeDataLoader<Organization, CoreOrganizationConnectionNode>>
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
            'Owner.user_id',
            'Owner.email',
        ])
        .leftJoin('OrganizationOwnership.user', 'Owner')
        .where('OrganizationOwnership.organization_id IN (:...ids)', {
            ids: organizationIds,
        })

    const ownerships = new Map<string, OrganizationOwnership>(
        (await scope.getMany()).map((ownership) => [
            ownership.organization_id,
            ownership,
        ])
    )

    const owners: UserSummaryNode[][] = []

    for (const id of organizationIds) {
        const ownership = ownerships.get(id)
        const owner = await ownership?.user

        if (!owner) {
            owners.push([])
        } else {
            const ownerId = owner.user_id
            const ownerEmail = owner.email || ''

            owners.push([{ id: ownerId, email: ownerEmail }])
        }
    }

    return owners
}
