import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'

const typeDefs = gql`
    extend type Mutation {
        subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
        uploadSubCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        subcategory(id: ID!): Subcategory
            @isAdmin(entity: "subcategory")
            @deprecated(
                reason: "Use 'subcategoryNode(id: ID!)' (when released)."
            )
    }
    type Subcategory {
        id: ID!
        name: String!
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }
    input SubcategoryDetail {
        id: ID
        name: String
        system: Boolean
    }
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Mutation: {
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                uploadSubCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubCategoriesFromCSV(args, ctx, info),
            },
            Query: {
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
            },
        },
    }
}
