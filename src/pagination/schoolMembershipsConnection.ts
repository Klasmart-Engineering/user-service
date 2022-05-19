import { SelectQueryBuilder } from 'typeorm'
import { SchoolMembership } from '../entities/schoolMembership'
import { Role } from '../entities/role'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'
import { scopeHasJoin } from '../utils/typeorm'
import { SchoolMembershipConnectionNode } from '../types/graphQL/schoolMembership'
import { School } from '../entities/school'

export const schoolMembershipsConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'user_id',
    aliases: {
        userId: 'user_id',
        schoolId: 'school_id',
    },
}

export async function schoolMembershipConnectionQuery(
    scope: SelectQueryBuilder<SchoolMembership>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('roleId', filter) && !scopeHasJoin(scope, Role)) {
            scope.leftJoin('SchoolMembership.roles', 'Role')
        }
        if (filterHasProperty('organizationId', filter)) {
            if (!scopeHasJoin(scope, School))
                scope.innerJoin('SchoolMembership.school', 'School')
            scope.innerJoin('School.organization', 'Organization')
        }
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                userId: 'SchoolMembership.user_id',
                schoolId: 'SchoolMembership.school_id',
                roleId: 'Role.role_id',
                status: 'SchoolMembership.status',
                organizationId: 'Organization.organization_id',
            })
        )
    }

    const selects = ([
        'user_id',
        'school_id',
        'join_timestamp',
        'status',
    ] as (keyof SchoolMembership)[]).map((field) => `SchoolMembership.${field}`)

    scope.select(selects)

    return scope
}

export async function mapSchoolMembershipToSchoolMembershipNode(
    schoolMembership: SchoolMembership
): Promise<SchoolMembershipConnectionNode> {
    return {
        userId: schoolMembership.user_id,
        schoolId: schoolMembership.school_id,
        status: schoolMembership.status,
        joinTimestamp: schoolMembership.join_timestamp,
    }
}
