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
    const scope = await User.createQueryBuilder(
        'User'
    ).where('User.user_id IN (:...ids)', { ids: userIds })

    if (filter) {
        scope.leftJoinAndSelect('User.memberships', 'Memberships')

        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('Memberships.organization', 'Organization')
        }

        if (filterHasProperty('roleId', filter)) {
            scope.leftJoinAndSelect('Memberships.roles', 'Roles')
        }

        if (filterHasProperty('classId', filter)) {
            scope
                .leftJoin('User.classesStudying', 'ClassStudying')
                .leftJoin('User.classesTeaching', 'ClassTeaching')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'Memberships.organization_id',
                schoolId: '', // don't attempt to filter by schoolId
                roleId: 'Roles.role_id',
                organizationUserStatus: 'Memberships.status',
                userId: "concat(User.user_id, '')",
                phone: 'User.phone',
                classId: {
                    operator: 'OR',
                    aliases: [
                        'ClassStudying.class_id',
                        'ClassTeaching.class_id',
                    ],
                },
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
    const scope = await User.createQueryBuilder(
        'User'
    ).where('User.user_id IN (:...ids)', { ids: userIds })

    if (filter) {
        scope
            .leftJoinAndSelect('User.school_memberships', 'Memberships')
            .leftJoinAndSelect('Memberships.school', 'School')

        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('School.organization', 'Organization')
        }

        if (filterHasProperty('roleId', filter)) {
            scope.leftJoinAndSelect('Memberships.roles', 'Roles')
        }

        if (filterHasProperty('classId', filter)) {
            scope
                .leftJoin('User.classesStudying', 'ClassStudying')
                .leftJoin('User.classesTeaching', 'ClassTeaching')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'Organization.organization_id',
                schoolId: 'Memberships.school_id',
                roleId: 'Roles.role_id',
                organizationUserStatus: '',
                userId: "concat(User.user_id, '')",
                phone: 'User.phone',
                classId: {
                    operator: 'OR',
                    aliases: [
                        'ClassStudying.class_id',
                        'ClassTeaching.class_id',
                    ],
                },
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
    const orgScope = await User.createQueryBuilder(
        'User'
    ).where('User.user_id IN (:...ids)', { ids: userIds })

    const schoolScope = await User.createQueryBuilder(
        'User'
    ).where('User.user_id IN (:...ids)', { ids: userIds })

    if (filter) {
        orgScope.leftJoinAndSelect('User.memberships', 'OrgMemberships')

        schoolScope.leftJoinAndSelect(
            'User.school_memberships',
            'SchoolMemberships'
        )

        if (filterHasProperty('organizationId', filter)) {
            schoolScope
                .leftJoinAndSelect('SchoolMemberships.school', 'School')
                .leftJoinAndSelect('School.organization', 'SchoolOrg')
        }

        if (filterHasProperty('roleId', filter)) {
            orgScope.leftJoinAndSelect('OrgMemberships.roles', 'OrgRoles')
            schoolScope.leftJoinAndSelect(
                'SchoolMemberships.roles',
                'SchoolRoles'
            )
        }

        if (filterHasProperty('classId', filter)) {
            orgScope
                .leftJoin('User.classesStudying', 'ClassStudying')
                .leftJoin('User.classesTeaching', 'ClassTeaching')

            schoolScope
                .leftJoin('User.classesStudying', 'ClassStudying')
                .leftJoin('User.classesTeaching', 'ClassTeaching')
        }

        orgScope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'OrgMemberships.organization_id',
                schoolId: '',
                roleId: 'OrgRoles.role_id',
                organizationUserStatus: '',
                userId: "concat(User.user_id, '')",
                classId: {
                    operator: 'OR',
                    aliases: [
                        'ClassStudying.class_id',
                        'ClassTeaching.class_id',
                    ],
                },
            })
        )

        schoolScope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: 'SchoolOrg.organization_id',
                schoolId: 'SchoolMemberships.school_id',
                roleId: 'SchoolRoles.role_id',
                organizationUserStatus: '',
                userId: "concat(User.user_id, '')",
                phone: 'User.phone',
                classId: {
                    operator: 'OR',
                    aliases: [
                        'ClassStudying.class_id',
                        'ClassTeaching.class_id',
                    ],
                },
            })
        )
    }

    const orgUsers = await orgScope.getMany()
    const schoolUsers = await schoolScope.getMany()

    //
    // translate to graphQL schema
    //
    const userRoles: RoleSummaryNode[][] = []
    for (const userId of userIds) {
        const orgUser = orgUsers.find((u) => u.user_id === userId)
        const schoolUser = schoolUsers.find((u) => u.user_id === userId)
        if (orgUser || schoolUser) {
            const roles: RoleSummaryNode[] = []
            const orgs = (await orgUser?.memberships) || []
            const schools = (await schoolUser?.school_memberships) || []

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
