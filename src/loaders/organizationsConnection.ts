import { OrganizationOwnership } from '../entities/organizationOwnership'
import { UserSummaryNode } from '../types/graphQL/userSummaryNode'
import DataLoader from 'dataloader'
import {
    IChildPaginationArgs,
    IPaginatedResponse,
} from '../utils/pagination/paginate'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
    usersConnectionQuery,
} from '../pagination/usersConnection'
import { User } from '../entities/user'
import {
    childConnectionLoader,
    IChildConnectionDataloaderKey,
} from './childConnectionLoader'

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

export const usersConnection = async (
    items: readonly IChildConnectionDataloaderKey[]
): Promise<IPaginatedResponse<CoreUserConnectionNode>[]> => {
    const parentIds = items.map((i) => i.parent.id)
    const args = items[0]?.args as IChildPaginationArgs<User>
    const parent = items[0].parent
    const info = items[0]?.info

    const baseScope = await usersConnectionQuery({
        direction: args.direction || 'FORWARD',
        directionArgs: {
            cursor: args.cursor,
        },
        scope: args.scope,
        filter: {
            [parent.filterKey]: {
                operator: 'in',
                value: parentIds as string[],
            },
            ...args.filter,
        },
    })

    return childConnectionLoader(
        parentIds,
        baseScope,
        parent.pivot,
        info,
        mapUserToUserConnectionNode,
        args,
        {
            primaryKey: 'user_id',
            aliases: {
                givenName: 'given_name',
                familyName: 'family_name',
            },
        }
    )
}
