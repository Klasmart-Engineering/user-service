import { OrganizationMembership } from '../entities/organizationMembership'
import DataLoader from 'dataloader'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'

export interface IUsersLoaders {
    user: DataLoader<string, User | Error>
    orgMemberships: DataLoader<string, OrganizationMembership[]>
    schoolMemberships: DataLoader<string, SchoolMembership[]>
}

export const orgMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<OrganizationMembership[][]> => {
    const scope = OrganizationMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const memberships = await scope.getMany()

    return userIds.map((userId) =>
        memberships.filter((m) => m.user_id === userId)
    )
}

export const schoolMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<SchoolMembership[][]> => {
    const scope = SchoolMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const memberships = await scope.getMany()

    return userIds.map((userId) =>
        memberships.filter((m) => m.user_id === userId)
    )
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
