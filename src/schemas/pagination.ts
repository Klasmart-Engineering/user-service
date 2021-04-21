import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    enum ConnectionDirection {
        FORWARD
        BACKWARD
    }

    input ConnectionsDirectionArgs {
        count: Int
        cursor: String
    }

    type ConnectionPageInfo {
        hasNextPage: Boolean
        hasPreviousPage: Boolean
        startCursor: String
        endCursor: String
    }

    interface iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
    }

    interface iConnectionEdge {
        cursor: String
    }
    # Core pagination schema defintion ends here

    # pagination extension types start here
    type UsersConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [UsersConnectionEdge]
    }
    type UsersConnectionEdge implements iConnectionEdge {
        cursor: String
        node: UsersConnectionNode
    }
    type UsersConnectionNode {
        user_id: ID!
        email: String!
    }
    # pagination extension types end here
    extend type Query {
        # define pagination queries

        usersConnection(
            direction: ConnectionDirection!

            directionArgs: ConnectionsDirectionArgs
        ): UsersConnectionResponse @isAdmin(entity: "user")
    }
`
export default function getDefault(
    model: Model,
    context?: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Query: {
                usersConnection: (_parent, args, ctx, _info) =>
                    model.usersConnection(ctx, args),
            },
        },
    }
}
