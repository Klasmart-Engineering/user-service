import { ApolloServerExpressConfig } from 'apollo-server-express'
import gql from 'graphql-tag'
import { Context } from '../main'
import { Model } from '../model'
import { SchoolMembershipConnectionNode } from '../types/graphQL/schoolMembership'

const typeDefs = gql`
    type SchoolMembershipsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [SchoolMembershipsConnectionEdge]
    }

    type SchoolMembershipsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: SchoolMembershipConnectionNode
    }

    input SchoolMembershipFilter {
        # table columns
        userId: UUIDFilter
        schoolId: UUIDFilter
        status: StringFilter

        # joined columns
        roleId: UUIDFilter

        AND: [SchoolMembershipFilter]
        OR: [SchoolMembershipFilter]
    }

    input SchoolMembershipSortInput {
        field: SchoolMembershipSortBy!
        order: SortOrder!
    }

    enum SchoolMembershipSortBy {
        userId
        schoolId
    }

    type SchoolMembershipConnectionNode {
        userId: String!
        schoolId: String!
        status: Status!
        joinTimestamp: String
        user: UserConnectionNode @isAdmin(entity: "user")
        school: SchoolConnectionNode @isAdmin(entity: "school")
    }
`

export default function getDefault(model: Model): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            SchoolMembershipConnectionNode: {
                user: (
                    parent: SchoolMembershipConnectionNode,
                    args,
                    ctx: Context
                ) => {
                    return ctx.loaders.userNode.node.instance.load({
                        id: parent.userId,
                        scope: args.scope,
                    })
                },
                school: (
                    parent: SchoolMembershipConnectionNode,
                    args,
                    ctx: Context
                ) => {
                    return ctx.loaders.schoolNode.instance.load({
                        id: parent.schoolId,
                        scope: args.scope,
                    })
                },
                // TODO
                // roles: (_parent, args, ctx: Context) => {},
            },
        },
    }
}
