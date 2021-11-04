import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { subcategoriesConnectionResolver } from '../pagination/subcategoriesConnection'

const typeDefs = gql`
    extend type Mutation {
        subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
        uploadSubCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    extend type Query {
        subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
        subcategoriesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            sort: SubcategorySortInput
            filter: SubcategoryFilter
        ): SubcategoriesConnectionResponse @isAdmin(entity: "subcategory")
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

    type SubcategoriesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [SubcategoriesConnectionEdge]
    }

    type SubcategoriesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: SubcategoriesConnectionNode
    }

    type SubcategoriesConnectionNode {
        id: ID!
        name: String!
        status: Status!
        system: Boolean!
    }

    enum SubcategorySortBy {
        id
        name
    }

    input SubcategorySortInput {
        field: SubcategorySortBy!
        order: SortOrder!
    }

    input SubcategoryFilter {
        status: StringFilter
        system: BooleanFilter

        # joined columns
        organizationId: UUIDFilter
        categoryId: UUIDFilter

        AND: [SubcategoryFilter]
        OR: [SubcategoryFilter]
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
                subcategoriesConnection: (_parent, args, ctx, info) =>
                    subcategoriesConnectionResolver(info, ctx, args),
            },
        },
    }
}
