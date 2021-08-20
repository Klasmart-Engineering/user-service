import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { CategoryConnectionNode } from '../types/graphQL/categoryConnectionNode'
import DataLoader from 'dataloader'
import {
    subcategoriesForCategories,
    subjectsForCategories,
    programsForCategories,
} from '../loaders/categoriesConnection'

const typeDefs = gql`
    extend type Mutation {
        category(id: ID!): Category @isAdmin(entity: "category")
        uploadCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    # pagination extension types start here
    type CategoriesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [CategoriesConnectionEdge]
    }

    type CategoriesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: CategoryConnectionNode
    }

    # pagination extension types end here

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

        # joined columns
        organizationId: UUIDFilter
        AND: [CategoryFilter]
        OR: [CategoryFilter]
    }

    type CategoryConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        subcategories: [SubcategorySummaryNode!]
        subjects: [SubjectSummaryNode!]
        programs: [ProgramSummaryNode!]
    }

    type SubcategorySummaryNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    extend type Query {
        category(id: ID!): Category @isAdmin(entity: "category")
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
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            CategoryConnectionNode: {
                subcategories: async (
                    category: CategoryConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.categoriesConnection?.subcategories?.load(
                        category.id
                    )
                },
                subjects: async (
                    category: CategoryConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.categoriesConnection?.subjects?.load(
                        category.id
                    )
                },
                programs: async (
                    category: CategoryConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.categoriesConnection?.programs?.load(
                        category.id
                    )
                },
            },
            Mutation: {
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
                uploadCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadCategoriesFromCSV(args, ctx, info),
            },
            Query: {
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
                categoriesConnection: (_parent, args, ctx: Context, _info) => {
                    ctx.loaders.categoriesConnection = {
                        subcategories: new DataLoader((keys) =>
                            subcategoriesForCategories(keys, args.filter)
                        ),
                        subjects: new DataLoader((keys) =>
                            subjectsForCategories(keys, args.filter)
                        ),
                        programs: new DataLoader((keys) =>
                            programsForCategories(keys, args.filter)
                        ),
                    }

                    return model.categoriesConnection(ctx, args)
                },
            },
        },
    }
}
