import { OrganizationMembership } from '../entities/organizationMembership'
import DataLoader from 'dataloader'
import { SchoolMembership } from '../entities/schoolMembership'

export interface IUsersLoaders {
    orgMemberships: DataLoader<string, OrganizationMembership[]>
    schoolMemberships: DataLoader<string, SchoolMembership[]>
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

export const schoolMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<SchoolMembership[][]> => {
    const schoolMemberships: SchoolMembership[][] = []

    const scope = SchoolMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const data = await scope.getMany()

    for (const userId of userIds) {
        const userMemberships = data.filter((m) => m.user_id === userId)
        schoolMemberships.push(userMemberships)
    }

    return schoolMemberships
}
