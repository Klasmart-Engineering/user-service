import { User } from '../entities/user'
import {
    IEntityFilter,
    getWhereClauseFromFilter,
    filterHasProperty,
} from '../utils/pagination/filtering'
import { OrganizationSummaryNode } from '../types/graphQL/organization'
import { SchoolSummaryNode } from '../types/graphQL/school'
import DataLoader from 'dataloader'
import { RoleSummaryNode } from '../types/graphQL/role'

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
            'OrganizationMembership.shortcode',
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
                userId: '',
                phone: '',
                classId: '',
            })
        )
    }

    const users = new Map(
        (await scope.getMany()).map((user) => [user.user_id, user])
    )

    return Promise.all(
        userIds.map(async (id) => {
            const memberships = (await users.get(id)?.memberships) ?? []
            return Promise.all(
                memberships.map(async (membership) => {
                    return {
                        id: membership.organization_id,
                        name: (await membership.organization)
                            ?.organization_name,
                        joinDate: membership.join_timestamp,
                        userStatus: membership.status,
                        status: (await membership.organization)?.status,
                        userShortCode: membership.shortcode,
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
                organizationUserStatus: '',
                userId: '',
                phone: '',
                classId: '',
            })
        )
    }

    const users = new Map(
        (await scope.getMany()).map((user) => [user.user_id, user])
    )

    return Promise.all(
        userIds.map(async (id) => {
            const memberships = (await users.get(id)?.school_memberships) ?? []
            return Promise.all(
                memberships.map(async (membership) => {
                    const school = await membership.school
                    return {
                        id: membership.school_id,
                        name: school?.school_name,
                        organizationId:
                            (await school?.organization)?.organization_id ?? '',
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
                userId: '',
                phone: '',
                classId: '',
            })
        )
    }

    const orgUsers = new Map(
        (await orgScope.getMany()).map((user) => [user.user_id, user])
    )

    const schoolUsers = new Map(
        (await schoolScope.getMany()).map((user) => [user.user_id, user])
    )

    return Promise.all(
        userIds.map(async (id) => {
            const organizationMemberships = await orgUsers.get(id)?.memberships
            const schoolMemberships = await schoolUsers.get(id)
                ?.school_memberships

            /* TODO: these forEach loops need to be reworked to
                     correctly wait for the promises to complete. */
            const roles: RoleSummaryNode[] = []
            organizationMemberships?.forEach(async (orgMembership) =>
                (await orgMembership.roles)?.forEach((role) =>
                    roles.push({
                        id: role.role_id,
                        name: role.role_name,
                        organizationId: orgMembership.organization_id,
                        status: role.status,
                    })
                )
            )
            schoolMemberships?.forEach(async (schoolMembership) =>
                (await schoolMembership.roles)?.forEach((role) =>
                    roles.push({
                        id: role.role_id,
                        name: role.role_name,
                        schoolId: schoolMembership.school_id,
                        status: role.status,
                    })
                )
            )
            return roles
        })
    )
}
