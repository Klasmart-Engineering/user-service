import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'

const typeDefs = gql`
    extend type Mutation {
        category(id: ID!): Category @isAdmin(entity: "category")
        uploadCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        category(id: ID!): Category
            @isAdmin(entity: "category")
            @deprecated(reason: "Use 'categoryNode(id: ID!)' (when released).")
    }
    type Category {
        id: ID!
        name: String!
        subcategories: [Subcategory!]
        system: Boolean!
        status: Status

        # Mutations
        editSubcategories(subcategory_ids: [ID!]): [Subcategory]
        delete(_: Int): Boolean
    }
    input CategoryDetail {
        id: ID
        name: String
        subcategories: [ID!]
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
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
                uploadCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadCategoriesFromCSV(args, ctx, info),
            },
            Query: {
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
            },
        },
    }
}
