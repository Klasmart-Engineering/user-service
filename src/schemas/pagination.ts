import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'

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

    enum SortOrder {
        ASC
        DESC
    }
    # Core pagination schema defintion ends here
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            iConnectionResponse: {
                __resolveType() {
                    return null
                },
            },
            iConnectionEdge: {
                __resolveType() {
                    return null
                },
            },
        },
    }
}
