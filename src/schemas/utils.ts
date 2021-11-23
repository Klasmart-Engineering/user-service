import gql from 'graphql-tag'
import { Model } from '../model'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { Context } from '../main'

const typeDefs = gql`
    type File {
        filename: String!
        mimetype: String!
        encoding: String!
    }
    type PageInfo {
        hasNextPage: Boolean!
        endCursor: String!
        startCursor: String!
        hasPreviousPage: Boolean!
    }
    type ScheduleEntry {
        id: ID!
        timestamp: Date
    }

    enum LogicalOperator {
        AND
        OR
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {},
    }
}
