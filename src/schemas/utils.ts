import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        createOrUpateSystemEntities(_: Int): Boolean @isAdmin
    }
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
    context?: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Mutation: {
                createOrUpateSystemEntities: (_parent, _args, _ctx, _info) =>
                    model.createOrUpdateSystemEntities(),
            },
        },
    }
}
