import DataLoader from 'dataloader'
import { SelectQueryBuilder } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { CoreUserConnectionNode } from '../pagination/usersConnection'
import { OrganizationSummaryNode } from '../types/graphQL/organization'
import { RoleSummaryNode } from '../types/graphQL/role'
import { SchoolSummaryNode } from '../types/graphQL/school'
import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'

export interface IUsersLoaders {
    user: Lazy<UserDataLoader>
    orgMemberships: Lazy<DataLoader<string, OrganizationMembership[]>>
    schoolMemberships: Lazy<DataLoader<string, SchoolMembership[]>>
}

export interface IUserNodeDataLoaders {
    node: Lazy<NodeDataLoader<User, CoreUserConnectionNode>>
    organizations: Lazy<DataLoader<string, OrganizationSummaryNode[]>>
    schools: Lazy<DataLoader<string, SchoolSummaryNode[]>>
    roles: Lazy<DataLoader<string, RoleSummaryNode[]>>
}

export const orgMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<OrganizationMembership[][]> => {
    const scope = OrganizationMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const memberships: Map<string, OrganizationMembership[]> = new Map()
    ;(await scope.getMany()).map((membership: OrganizationMembership) => {
        if (!memberships.has(membership.user_id)) {
            memberships.set(membership.user_id, [membership])
        } else {
            memberships.get(membership.user_id)?.push(membership)
        }
    })

    return userIds.map((id) => memberships.get(id) || [])
}

export const schoolMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<SchoolMembership[][]> => {
    const scope = SchoolMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const memberships: Map<string, SchoolMembership[]> = new Map()
    ;(await scope.getMany()).map((membership: SchoolMembership) => {
        if (!memberships.has(membership.user_id)) {
            memberships.set(membership.user_id, [membership])
        } else {
            memberships.get(membership.user_id)?.push(membership)
        }
    })

    return userIds.map((id) => memberships.get(id) || [])
}

export class UserDataLoader extends DataLoader<
    { id: string; scope: SelectQueryBuilder<User> },
    User | null
> {
    constructor() {
        super(async function (
            keys: readonly { id: string; scope: SelectQueryBuilder<User> }[]
        ): Promise<(User | null)[]> {
            const ids = []
            const scope = keys[0].scope
            for (const key of keys) {
                ids.push(key.id)
            }
            scope.andWhere(`"User"."user_id" IN (:...ids)`, {
                ids,
            })
            const entities = await scope.getMany()
            const usersMap = new Map<string, User>(
                entities.map((user) => [user.user_id, user])
            )

            return ids.map((id) => usersMap.get(id) ?? null)
        })
    }
}
