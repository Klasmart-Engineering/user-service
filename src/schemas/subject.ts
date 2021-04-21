import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        subject(id: ID!): Subject @isAdmin(entity: "subject")
        uploadSubjectsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        subject(id: ID!): Subject @isAdmin(entity: "subject")
    }
    type Subject {
        id: ID!
        name: String!
        categories: [Category!]
        subcategories: [Subcategory!]
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }
    input SubjectDetail {
        id: ID
        name: String
        categories: [ID!]
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
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
                uploadSubjectsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubjectsFromCSV(args, ctx, info),
            },
            Query: {
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
            },
        },
    }
}
