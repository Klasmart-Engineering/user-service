import gql from 'graphql-tag'
import { GraphQLSchemaModule } from '../types/schemaModule'

const typeDefs = gql`
    enum ConnectionDirection {
        FORWARD
        BACKWARD
    }

    input ConnectionsDirectionArgs {
        count: PageSize
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
const schemaModule: GraphQLSchemaModule = {
    typeDefs,
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

export default schemaModule
