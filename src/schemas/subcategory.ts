import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { subcategoriesConnectionResolver } from '../pagination/subcategoriesConnection'
import {
    deleteSubcategories,
    updateSubcategories,
    createSubcategories,
} from '../resolvers/subcategory'

const typeDefs = gql`
    extend type Mutation {
        subcategory(id: ID!): Subcategory
            @isAdmin(entity: "subcategory")
            @deprecated(
                reason: "Sunset Date: 22/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2457174175"
            )
        uploadSubCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        deleteSubcategories(
            input: [DeleteSubcategoryInput!]!
        ): SubcategoriesMutationResult
        updateSubcategories(
            input: [UpdateSubcategoryInput!]!
        ): SubcategoriesMutationResult
        createSubcategories(
            input: [CreateSubcategoryInput!]!
        ): SubcategoriesMutationResult
    }

    extend type Query {
        subcategory(id: ID!): Subcategory
            @isAdmin(entity: "subcategory")
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        subcategoryNode(id: ID!): SubcategoryConnectionNode
            @isAdmin(entity: "subcategory")
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
            @deprecated(
                reason: "Sunset Date: 10/02/2022 Details: https://github.com/KL-Engineering/user-service/tree/main/documents/rfc/mutations/050-Subcategory-toplevel-mutations.md"
            )
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
        node: SubcategoryConnectionNode
    }

    type SubcategoryConnectionNode {
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

    input DeleteSubcategoryInput {
        id: ID!
    }

    input UpdateSubcategoryInput {
        id: ID!
        name: String
    }

    type SubcategoriesMutationResult {
        subcategories: [SubcategoryConnectionNode!]!
    }

    input CreateSubcategoryInput {
        name: String!
        organizationId: ID!
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
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                uploadSubCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubCategoriesFromCSV(args, ctx, info),
                deleteSubcategories: (_parent, args, ctx, info) =>
                    deleteSubcategories(args, ctx),
                updateSubcategories: (_parent, args, ctx, _info) =>
                    updateSubcategories(args, ctx),
                createSubcategories: (_parent, args, ctx, _info) =>
                    createSubcategories(args, ctx),
            },
            Query: {
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                subcategoriesConnection: (_parent, args, ctx, info) =>
                    subcategoriesConnectionResolver(info, ctx, args),
                subcategoryNode: (_parent, args, ctx) =>
                    ctx.loaders.subcategoryNode.node.instance.load(args),
            },
        },
    }
}
