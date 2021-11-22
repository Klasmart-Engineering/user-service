import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { OrganizationMembershipConnectionNode } from '../types/graphQL/organizationMemberships'
import {
    IChildPaginationArgs,
    IPaginatedResponse,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'
import { GraphQLResolveInfo } from 'graphql'
import { RoleConnectionNode } from '../types/graphQL/role'
import { IDataLoaders } from '../loaders/setup'
import { GraphQLSchemaModule } from '../types/schemaModule'

const typeDefs = gql`
    type OrganizationMembershipsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [OrganizationMembershipsConnectionEdge]
    }

    type OrganizationMembershipsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: OrganizationMembershipConnectionNode
    }

    input OrganizationMembershipFilter {
        # table columns
        shortCode: StringFilter
        organizationId: UUIDFilter
        userId: UUIDFilter
        status: StringFilter

        # joined columns
        roleId: UUIDFilter

        AND: [OrganizationMembershipFilter]
        OR: [OrganizationMembershipFilter]
    }

    input OrganizationMembershipSortInput {
        field: OrganizationMembershipSortBy!
        order: SortOrder!
    }

    enum OrganizationMembershipSortBy {
        userId
        organizationId
    }

    type OrganizationMembershipConnectionNode {
        userId: String!
        organizationId: String!
        status: Status!
        shortCode: String
        joinTimestamp: String
        user: UserConnectionNode @isAdmin(entity: "user")
        organization: OrganizationConnectionNode
            @isAdmin(entity: "organization")
        rolesConnection(
            count: PageSize
            cursor: String
            filter: RoleFilter
            sort: RoleSortInput
            direction: ConnectionDirection
        ): RolesConnectionResponse
    }
`

export async function rolesConnectionChildResolver(
    membership: Pick<
        OrganizationMembershipConnectionNode,
        'organizationId' | 'userId'
    >,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    const includeTotalCount = shouldIncludeTotalCount(info, args)
    return rolesConnectionChild(
        membership.organizationId,
        membership.userId,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

export async function rolesConnectionChild(
    orgId: OrganizationMembershipConnectionNode['organizationId'],
    userId: OrganizationMembershipConnectionNode['userId'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    return loaders.membershipRolesConnectionChild.instance.load({
        args,
        includeTotalCount,
        parent: {
            compositeId: [orgId, userId],
            filterKeys: [
                'membershipOrganizationId',
                'membershipOrganizationUserId',
            ],
            pivots: [
                '"OrganizationMembership"."organizationOrganizationId"',
                '"OrganizationMembership"."user_id"',
            ],
        },
        primaryColumn: 'role_id',
    })
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            OrganizationMembershipConnectionNode: {
                user: (
                    parent: OrganizationMembershipConnectionNode,
                    args,
                    ctx: Context
                ) => {
                    return ctx.loaders.userNode.node.instance.load({
                        id: parent.userId,
                        scope: args.scope,
                    })
                },
                organization: (
                    parent: OrganizationMembershipConnectionNode,
                    args,
                    ctx: Context
                ) => {
                    return ctx.loaders.organizationNode.node.instance.load({
                        id: parent.organizationId,
                        scope: args.scope,
                    })
                },
                rolesConnection: rolesConnectionChildResolver,
            },
        },
    }
}
