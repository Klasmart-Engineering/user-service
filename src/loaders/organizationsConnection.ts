import { OrganizationOwnership } from '../entities/organizationOwnership'
import { UserSummaryNode } from '../types/graphQL/userSummaryNode'
import DataLoader from 'dataloader'
import {
    IChildPaginationArgs,
    IPaginatedResponse,
    IPaginationArgs,
} from '../utils/pagination/paginate'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
    usersConnectionQuery,
} from '../pagination/usersConnection'
import { User } from '../entities/user'
import { childConnectionLoader } from './childConnectionLoader'
import { GraphQLResolveInfo } from 'graphql'

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
    items: readonly { orgId: string; args: IPaginationArgs<User> }[],
    info: GraphQLResolveInfo
): Promise<IPaginatedResponse<CoreUserConnectionNode>[]> => {
    const orgIds = items.map((i) => i.orgId)
    const args = items[0]?.args as IChildPaginationArgs<User>

    const baseScope = await usersConnectionQuery(info, {
        direction: 'FORWARD',
        directionArgs: {
            cursor: args.cursor,
        },
        scope: args.scope,
        filter: {
            organizationId: {
                operator: 'in',
                value: orgIds as string[],
            },
            ...args.filter,
        },
    })

    return childConnectionLoader(
        orgIds,
        baseScope,
        '"OrganizationMembership"."organization_id"',
        'User_',
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
