import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { createCategories, updateCategories } from '../resolvers/category'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { addSubcategoriesToCategories } from '../resolvers/category'

const typeDefs = gql`
    extend type Mutation {
        category(id: ID!): Category @isAdmin(entity: "category")
        uploadCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        createCategories(
            input: [CreateCategoryInput!]!
        ): CategoriesMutationResult
        updateCategories(
            input: [UpdateCategoryInput!]!
        ): CategoriesMutationResult
        addSubcategoriesToCategories(
            input: [AddSubcategoriesToCategoryInput!]!
        ): CategoriesMutationResult
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

    input CreateCategoryInput {
        name: String!
        organizationId: ID!
        subcategories: [ID!]
    }

    input UpdateCategoryInput {
        id: ID!
        name: String
        subcategories: [ID!]
    }

    type CategoriesMutationResult {
        categories: [CategoryConnectionNode!]!
    }

    input AddSubcategoriesToCategoryInput {
        categoryId: ID!
        subcategoryIds: [ID!]!
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
            @deprecated(
                reason: "Sunset Date: 22/02/2022 Details: https://calmisland.atlassian.net/l/c/U107XwHS"
            )
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
                createCategories: (_parent, args, ctx, _info) =>
                    createCategories(args, ctx),
                updateCategories: (_parent, args, ctx, _info) =>
                    updateCategories(args, ctx),
                addSubcategoriesToCategories: (_parent, args, ctx, info) =>
                    addSubcategoriesToCategories(args, ctx),
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
