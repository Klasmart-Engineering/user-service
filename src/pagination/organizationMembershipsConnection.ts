import { SelectQueryBuilder } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { OrganizationMembershipConnectionNode } from '../types/graphQL/organizationMemberships'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'
import { scopeHasJoin } from '../utils/typeorm'

export const organizationMembershipsConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'user_id',
    aliases: {
        userId: 'user_id',
        organizationId: 'organization_id',
    },
}

export async function organizationMembershipConnectionQuery(
    scope: SelectQueryBuilder<OrganizationMembership>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('roleId', filter) && !scopeHasJoin(scope, Role)) {
            scope.leftJoin('OrganizationMembership.roles', 'Role')
        }
        scope.andWhere(
            getWhereClauseFromFilter(scope, filter, {
                userId: 'OrganizationMembership.user_id',
                organizationId: 'OrganizationMembership.organization_id',
                shortCode: 'OrganizationMembership.shortcode',
                roleId: 'Role.role_id',
                status: 'OrganizationMembership.status',
            })
        )
    }

    const selects = ([
        'user_id',
        'organization_id',
        'join_timestamp',
        'status',
        'shortcode',
    ] as (keyof OrganizationMembership)[]).map(
        (field) => `OrganizationMembership.${field}`
    )

    scope.select(selects)

    return scope
}

export async function mapOrganizationMembershipToOrganizationMembershipNode(
    organizationMembership: OrganizationMembership
): Promise<OrganizationMembershipConnectionNode> {
    return {
        userId: organizationMembership.user_id,
        organizationId: organizationMembership.organization_id,
        status: organizationMembership.status,
        joinTimestamp: organizationMembership.join_timestamp,
        shortCode: organizationMembership.shortcode,
    }
}
