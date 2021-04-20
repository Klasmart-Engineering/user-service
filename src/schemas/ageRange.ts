import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        age_range(id: ID!): AgeRange @isAdmin(entity: "ageRange")
        uploadAgeRangesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        age_range(id: ID!): AgeRange @isAdmin(entity: "ageRange")
    }
    type AgeRange {
        id: ID!
        name: String!
        low_value: Int!
        high_value: Int!
        low_value_unit: AgeRangeUnit!
        high_value_unit: AgeRangeUnit!
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }
    input AgeRangeDetail {
        id: ID
        name: String
        low_value: Int
        high_value: Int
        low_value_unit: AgeRangeUnit
        high_value_unit: AgeRangeUnit
        system: Boolean
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
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
                uploadAgeRangesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadAgeRangesFromCSV(args, ctx, info),
            },
            Query: {
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
            },
        },
    }
}
