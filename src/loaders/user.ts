import { OrganizationMembership } from '../entities/organizationMembership'
import DataLoader from 'dataloader'

export interface IUsersLoaders {
    orgMemberships: DataLoader<string, OrganizationMembership[]>
}

export const orgMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<OrganizationMembership[][]> => {
    const memberships: OrganizationMembership[][] = []

    const scope = OrganizationMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const data = await scope.getMany()

    for (const userId of userIds) {
        const userMemberships = data.filter((m) => m.user_id === userId)
        memberships.push(userMemberships)
    }

    return memberships
}
