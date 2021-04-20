import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        grade(id: ID!): Grade @isAdmin(entity: "grade")
        uploadGradesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        grade(id: ID!): Grade @isAdmin(entity: "grade")
    }
    type Grade {
        id: ID!
        name: String!
        progress_from_grade: Grade
        progress_to_grade: Grade
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }
    input GradeDetail {
        id: ID
        name: String
        progress_from_grade_id: ID
        progress_to_grade_id: ID
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
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                uploadGradesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadGradesFromCSV(args, ctx, info),
            },
            Query: {
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
            },
        },
    }
}
