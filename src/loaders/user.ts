import DataLoader from 'dataloader'
import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { Lazy } from '../utils/lazyLoading'

export interface IUsersLoaders {
    user: Lazy<DataLoader<string, User | Error>>
    orgMemberships: Lazy<DataLoader<string, OrganizationMembership[]>>
    schoolMemberships: Lazy<DataLoader<string, SchoolMembership[]>>
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

export async function usersByIds(
    userIds: readonly string[]
): Promise<(User | Error)[]> {
    const users = new Map(
        (await User.findByIds(userIds as string[])).map((user) => [
            user.user_id,
            user,
        ])
    )

    return userIds.map(
        // TODO: convert to APIError once hotfix branch is aligned to master
        (id) => users.get(id) ?? Error("User doesn't exist")
    )
}
