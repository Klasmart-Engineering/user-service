import { User } from '../entities/user'
import {
    IEntityFilter,
    getWhereClauseFromFilter,
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
    const scope = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.memberships', 'memberships')
        .leftJoinAndSelect('memberships.organization', 'organization')
        .leftJoinAndSelect('memberships.roles', 'roles')
        .where('user.user_id IN (:...ids)', { ids: userIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['memberships.organization_id'],
                schoolId: [], // don't attempt to filter by schoolId
                roleId: ['roles.role_id'],
                organizationUserStatus: ['memberships.status'],
                userId: ["concat(user.user_id, '')"],
            })
        )
    }
    const users = await scope.getMany()

    //
    // translate to graphQL schema
    //
    const userOrgs: OrganizationSummaryNode[][] = []
    for (const userId of userIds) {
        const user = users.find((u) => u.user_id === userId)
        if (user) {
            const orgs: OrganizationSummaryNode[] = []
            const memberships = (await user.memberships) || []
            for (const m of memberships) {
                orgs.push({
                    id: m.organization_id,
                    name: (await m.organization)?.organization_name,
                    joinDate: m.join_timestamp,
                    userStatus: m.status,
                    status: (await m.organization)?.status,
                })
            }
            userOrgs.push(orgs)
        } else {
            userOrgs.push([])
        }
    }
    return userOrgs
}

export const schoolsForUsers = async (
    userIds: readonly string[],
    filter?: IEntityFilter
): Promise<SchoolSummaryNode[][]> => {
    //
    // fetch school memberships for all users
    // and join on required entities
    //
    const scope = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.school_memberships', 'memberships')
        .leftJoinAndSelect('memberships.school', 'school')
        .leftJoinAndSelect('memberships.roles', 'roles')
        .leftJoinAndSelect('school.organization', 'organization')
        .where('user.user_id IN (:...ids)', { ids: userIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['organization.organization_id'],
                schoolId: ['memberships.school_id'],
                roleId: ['roles.role_id'],
                organizationUserStatus: [],
                userId: ["concat(user.user_id, '')"],
            })
        )
    }
    const users = await scope.getMany()

    //
    // translate to graphQL schema
    //
    const userSchools: SchoolSummaryNode[][] = []
    for (const userId of userIds) {
        const user = users.find((u) => u.user_id === userId)
        if (user) {
            const schools: SchoolSummaryNode[] = []
            const memberships = (await user.school_memberships) || []
            for (const m of memberships) {
                schools.push({
                    id: m.school_id,
                    name: (await m.school)?.school_name,
                    organizationId:
                        (await (await m.school)?.organization)
                            ?.organization_id || '',
                    userStatus: m.status,
                    status: (await m.school)?.status,
                })
            }
            userSchools.push(schools)
        } else {
            userSchools.push([])
        }
    }
    return userSchools
}

export const rolesForUsers = async (
    userIds: readonly string[],
    filter?: IEntityFilter
): Promise<RoleSummaryNode[][]> => {
    //
    // fetch school & organization membership roles for each user
    const scope = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.memberships', 'orgMemberships')
        .leftJoinAndSelect('orgMemberships.roles', 'orgRoles')
        .leftJoinAndSelect('user.school_memberships', 'schoolMemberships')
        .leftJoinAndSelect('schoolMemberships.roles', 'schoolRoles')
        .leftJoinAndSelect('schoolMemberships.school', 'school')
        .leftJoinAndSelect('school.organization', 'schoolOrg')
        .where('user.user_id IN (:...ids)', { ids: userIds })
        .andWhere(
            "concat(schoolOrg.organization_id, '') = concat(orgMemberships.organization_id, '')"
        )

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: [
                    'orgMemberships.organization_id',
                    'schoolOrg.organization_id',
                ],
                schoolId: ['schoolMemberships.school_id'],
                roleId: ['orgRoles.role_id', 'schoolRoles.role_id'],
                organizationUserStatus: [],
                userId: ["concat(user.user_id, '')"],
            })
        )
    }
    const users = await scope.getMany()

    //
    // translate to graphQL schema
    //
    const userRoles: RoleSummaryNode[][] = []
    for (const userId of userIds) {
        const user = users.find((u) => u.user_id === userId)
        if (user) {
            const roles: RoleSummaryNode[] = []
            const orgs = (await user.memberships) || []
            const schools = (await user.school_memberships) || []

            for (const m of orgs) {
                const mRoles = (await m.roles) || []
                for (const r of mRoles) {
                    roles.push({
                        id: r.role_id,
                        name: r.role_name,
                        organizationId: m.organization_id,
                        status: r.status,
                    })
                }
            }
            for (const m of schools) {
                const mRoles = (await m.roles) || []
                for (const r of mRoles) {
                    roles.push({
                        id: r.role_id,
                        name: r.role_name,
                        schoolId: m.school_id,
                        status: r.status,
                    })
                }
            }
            userRoles.push(roles)
        } else {
            userRoles.push([])
        }
    }
    return userRoles
}
