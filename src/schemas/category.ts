import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { GraphQLSchemaModule } from '../types/schemaModule'

const typeDefs = gql`
    extend type Mutation {
        category(id: ID!): Category @isAdmin(entity: "category")
        uploadCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    type CategoriesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [CategoriesConnectionEdge]
    }
    type CategoriesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: CategoryConnectionNode
    }
    enum CategorySortBy {
        id
        name
    }
    input CategorySortInput {
        field: CategorySortBy!
        order: SortOrder!
    }
    input CategoryFilter {
        status: StringFilter
        system: BooleanFilter
        AND: [CategoryFilter]
        OR: [CategoryFilter]
    }
    type CategoryConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }
    extend type Query {
        category(id: ID!): Category
            @isAdmin(entity: "category")
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        categoryNode(id: ID!): CategoryConnectionNode
            @isAdmin(entity: "category")
        categoriesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: CategoryFilter
            sort: CategorySortInput
        ): CategoriesConnectionResponse @isAdmin(entity: "category")
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
): GraphQLSchemaModule {
    return {
        typeDefs,
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
                categoriesConnection: (_parent, args, ctx: Context, info) => {
                    return model.categoriesConnection(ctx, info, args)
                },
                categoryNode: (_parent, args, ctx) => {
                    return ctx.loaders.categoryNode.node.instance.load(args)
                },
            },
        },
    }
}
