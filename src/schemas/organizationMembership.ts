import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { OrganizationMembershipConnectionNode } from '../types/graphQL/organizationMemberships'

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
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
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
                // TODO
                // roles: (_parent, args, ctx: Context) => {},
            },
        },
    }
}
