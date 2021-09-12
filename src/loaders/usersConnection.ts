import { User } from '../entities/user'
import {
    IEntityFilter,
    getWhereClauseFromFilter,
    filterHasProperty,
} from '../utils/pagination/filtering'
import { OrganizationSummaryNode } from '../types/graphQL/organizationSummaryNode'
import { SchoolSummaryNode } from '../types/graphQL/schoolSummaryNode'
import DataLoader from 'dataloader'
import { RoleSummaryNode } from '../types/graphQL/roleSummaryNode'

export interface IUsersConnectionLoaders {
    organizations?: DataLoader<string, OrganizationSummaryNode[]>
    schools?: DataLoader<string, SchoolSummaryNode[]>
    roles?: DataLoader<string, RoleSummaryNode[]>
}

export const orgsForUsers = async (
    userIds: readonly string[],
    filter?: IEntityFilter
): Promise<OrganizationSummaryNode[][]> => {
    //
    // fetch organization memberships for all users
    // and join on required entities
    //
    const scope = User.createQueryBuilder('User')
        .innerJoin('User.memberships', 'OrganizationMembership')
        .innerJoin('OrganizationMembership.organization', 'Organization')
        .where('User.user_id IN (:...ids)', { ids: userIds })
        .select([
            'User.user_id',
            'OrganizationMembership.organization_id',
            'OrganizationMembership.join_timestamp',
            'OrganizationMembership.status',
            'Organization.organization_name',
            'Organization.status',
        ])

    if (filter) {
        if (filterHasProperty('roleId', filter)) {
            scope.innerJoin('OrganizationMembership.roles', 'Roles')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'OrganizationMembership.organization_id',
                schoolId: '',
                roleId: 'Roles.role_id',
                organizationUserStatus: 'OrganizationMembership.status',
                permissionIds: '',
                userId: '',
                phone: '',
                classId: '',
            })
        )
    }

    const users = await scope.getMany()

    const map = new Map(users.map((user) => [user.user_id, user]))

    return Promise.all(
        userIds.map(async (id) => {
            const user = map.get(id)
            if (!user) return []

            const memberships = (await user.memberships) ?? []
            return Promise.all(
                memberships.map(async (membership) => {
                    return {
                        id: membership.organization_id,
                        name: (await membership.organization)
                            ?.organization_name,
                        joinDate: membership.join_timestamp,
                        userStatus: membership.status,
                        status: (await membership.organization)?.status,
                    }
                })
            )
        })
    )
}

export const schoolsForUsers = async (
    userIds: readonly string[],
    filter?: IEntityFilter
): Promise<SchoolSummaryNode[][]> => {
    //
    // fetch school memberships for all users
    // and join on required entities
    //
    const scope = await User.createQueryBuilder('User')
        .innerJoin('User.school_memberships', 'OrganizationMembership')
        .innerJoin('OrganizationMembership.school', 'School')
        // TODO expose `organization_id` FK column on School entity to save JOIN
        .innerJoin('School.organization', 'Organization')
        .where('User.user_id IN (:...ids)', { ids: userIds })
        .select([
            'User.user_id',
            'School.school_id',
            'School.school_name',
            'School.status',
            'OrganizationMembership.school_id',
            'OrganizationMembership.status',
            'Organization.organization_id',
        ])

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'School.organization',
                schoolId: '',
                roleId: '',
                permissionIds: '',
                organizationUserStatus: '',
                userId: '',
                phone: '',
                classId: '',
            })
        )
    }

    const users = await scope.getMany()

    const map = new Map(users.map((user) => [user.user_id, user]))

    return Promise.all(
        userIds.map(async (id) => {
            const user = map.get(id)
            if (!user) return []

            const memberships = (await user.school_memberships) ?? []
            return Promise.all(
                memberships.map(async (membership) => {
                    const school = await membership.school
                    return {
                        id: membership.school_id,
                        name: school?.school_name,
                        organizationId:
                            (await school?.organization)?.organization_id ?? '',
                        userStatus: membership.status,
                        status: school?.status,
                    }
                })
            )
        })
    )
}

export const rolesForUsers = async (
    userIds: readonly string[],
    filter?: IEntityFilter
): Promise<RoleSummaryNode[][]> => {
    const commonFields = [
        'User.user_id',
        'Role.role_id',
        'Role.role_name',
        'Role.status',
    ]
    //
    // fetch school & organization membership roles for each user
    // need to be fetched separately, as TypeORM doesn't support UNION (which would be perfect here)
    const orgScope = await User.createQueryBuilder('User')
        .innerJoin('User.memberships', 'OrganizationMembership')
        .innerJoin('OrganizationMembership.roles', 'Role')
        .where('User.user_id IN (:...ids)', { ids: userIds })
        .select([...commonFields, 'OrganizationMembership.organization_id'])

    const schoolScope = await User.createQueryBuilder('User')
        .innerJoin('User.school_memberships', 'SchoolMembership')
        .innerJoin('SchoolMembership.roles', 'Role')
        .where('User.user_id IN (:...ids)', { ids: userIds })
        .select([...commonFields, 'SchoolMembership.school_id'])

    if (filter) {
        orgScope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'OrganizationMembership.organization_id',
                schoolId: '',
                roleId: '',
                phone: '',
                organizationUserStatus: '',
                permissionIds: '',
                userId: '',
                classId: '',
            })
        )

        if (filterHasProperty('organizationId', filter)) {
            // Use hidden TypeORM FK column `School.organizationOrganizationId` to save a JOIN to `Organization`
            schoolScope.innerJoin('SchoolMembership.school', 'School')
        }

        schoolScope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'School.organization',
                schoolId: 'SchoolMembership.school_id',
                roleId: '',
                organizationUserStatus: '',
                permissionIds: '',
                userId: '',
                phone: '',
                classId: '',
            })
        )
    }

    const orgUsers = await orgScope.getMany()
    const schoolUsers = await schoolScope.getMany()

    const orgMap = new Map(orgUsers.map((user) => [user.user_id, user]))
    const schoolMap = new Map(schoolUsers.map((user) => [user.user_id, user]))

    return Promise.all(
        userIds.map(async (id) => {
            const orgUser = orgMap.get(id)
            const schoolUser = schoolMap.get(id)

            if (!(orgUser || schoolUser)) return []

            const OrganizationMemberships = (await orgUser?.memberships) ?? []
            const schoolMemberships =
                (await schoolUser?.school_memberships) ?? []

            const roles: RoleSummaryNode[] = []
            OrganizationMemberships.forEach(async (orgMembership) => {
                const orgRoles = (await orgMembership.roles) ?? []
                orgRoles.forEach((role) => {
                    roles.push({
                        id: role.role_id,
                        name: role.role_name,
                        organizationId: orgMembership.organization_id,
                        status: role.status,
                    })
                })
            })
            schoolMemberships.forEach(async (schoolMembership) => {
                const schoolRoles = (await schoolMembership.roles) ?? []
                schoolRoles.forEach((role) => {
                    roles.push({
                        id: role.role_id,
                        name: role.role_name,
                        schoolId: schoolMembership.school_id,
                        status: role.status,
                    })
                })
            })
            return roles
        })
    )
}
