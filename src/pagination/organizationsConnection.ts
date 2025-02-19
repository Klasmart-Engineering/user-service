import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { User } from '../entities/user'
import { OrganizationConnectionNode } from '../types/graphQL/organization'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
import {
    IConnectionSortingConfig,
    ISortField,
} from '../utils/pagination/sorting'
import { scopeHasJoin } from '../utils/typeorm'

/**
 * Core fields on `OrganizationConnectionNode` not populated by a DataLoader
 */
export type CoreOrganizationConnectionNode = Pick<
    OrganizationConnectionNode,
    'id' | 'name' | 'contactInfo' | 'shortCode' | 'status'
>

export const organizationConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'organization_id',
    aliases: {
        name: 'organization_name',
        ownerEmail: 'Owner.email',
    },
}

export async function organizationsConnectionResolver(
    info: GraphQLResolveInfo,
    {
        direction,
        directionArgs,
        scope,
        filter,
        sort,
    }: IPaginationArgs<Organization>
): Promise<IPaginatedResponse<CoreOrganizationConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    const newScope = await organizationsConnectionQuery(scope, filter, sort)

    const data = await paginateData<Organization>({
        direction,
        directionArgs,
        scope: newScope,
        sort: {
            ...organizationConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map((edge) => {
            return {
                node: mapOrganizationToOrganizationConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export async function organizationsConnectionQuery(
    scope: SelectQueryBuilder<Organization>,
    filter?: IEntityFilter,
    sort?: ISortField
) {
    if (filter) {
        if (
            filterHasProperty('ownerUserId', filter) ||
            filterHasProperty('ownerUserEmail', filter) ||
            filterHasProperty('ownerUsername', filter)
        ) {
            scope.innerJoin('Organization.owner', 'Owner')
        }

        if (
            filterHasProperty('userId', filter) &&
            !scopeHasJoin(scope, OrganizationMembership)
        ) {
            scope.innerJoin(
                OrganizationMembership,
                'OrganizationMembership',
                'Organization.organization_id = OrganizationMembership.organizationOrganizationId'
            )
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Organization.organization_id',
                name: 'Organization.organization_name',
                shortCode: 'Organization.shortCode',
                status: 'Organization.status',
                phone: 'Organization.phone',

                // connections
                userId: 'OrganizationMembership.userUserId',
                ownerUserId: 'Owner.user_id',
                ownerUserEmail: 'Owner.email',
                ownerUsername: 'Owner.username',
            })
        )
    }

    scope.select(organizationSummaryNodeFields)

    /*
    joining organization's owner to get owner's email
    */
    if (sort?.field.includes('ownerEmail')) {
        if (!scopeHasJoin(scope, User)) {
            scope.leftJoin('Organization.owner', 'Owner')
        }

        scope.addSelect('Owner.email')
    }

    return scope
}

export function mapOrganizationToOrganizationConnectionNode(
    organization: Organization
): CoreOrganizationConnectionNode {
    return {
        id: organization.organization_id,
        name: organization.organization_name,
        shortCode: organization.shortCode,
        status: organization.status,
        contactInfo: {
            address1: organization.address1,
            address2: organization.address2,
            phone: organization.phone,
        },
        // other properties have dedicated resolvers that use Dataloader
    }
}

export const organizationSummaryNodeFields = ([
    'organization_id',
    'organization_name',
    'address1',
    'address2',
    'phone',
    'shortCode',
    'status',
] as (keyof Organization)[]).map((field) => `Organization.${field}`)
