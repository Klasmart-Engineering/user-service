import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
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
`

export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {},
    }
}
