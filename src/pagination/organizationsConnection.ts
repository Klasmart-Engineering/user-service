import { GraphQLResolveInfo } from 'graphql'
import { Organization } from '../entities/organization'
import { OrganizationOwnership } from '../entities/organizationOwnership'
import { OrganizationConnectionNode } from '../types/graphQL/organizationConnectionNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

/**
 * Core fields on `OrganizationConnectionNode` not populated by a DataLoader
 */
export type CoreOrganizationConnectionNode = Pick<
    OrganizationConnectionNode,
    'id' | 'name' | 'contactInfo' | 'shortCode' | 'status'
>

export const ORGANIZATION_NODE_COLUMNS = ([
    'organization_id',
    'organization_name',
    'address1',
    'address2',
    'phone',
    'shortCode',
    'status',
] as (keyof Organization)[]).map((field) => `Organization.${field}`)

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

    if (filter) {
        if (filterHasProperty('ownerUserId', filter)) {
            scope.innerJoin(
                OrganizationOwnership,
                'OrganizationOwnership',
                'Organization.organization_id = OrganizationOwnership.organization_id'
            )
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Organization.organization_id',
                name: 'Organization.organization_name',
                shortCode: 'Organization.shortCode',
                status: 'Organization.status',

                // connections
                ownerUserId: 'OrganizationOwnership.user_id',
            })
        )
    }

    scope.select(ORGANIZATION_NODE_COLUMNS)

    const data = await paginateData<Organization>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'organization_id',
            aliases: {
                name: 'organization_name',
            },
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
