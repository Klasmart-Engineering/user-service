import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { SubcategoryConnectionNode } from '../types/graphQL/subcategoryConnectionNode'
import DataLoader from 'dataloader'
import {
    categoriesForSubcategories,
    programsForSubcategories,
    subjectsForSubcategories,
} from '../loaders/subcategoriesConnection'

const typeDefs = gql`
    extend type Mutation {
        subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
        uploadSubCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    # pagination extension types start here
    type SubcategoriesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [SubcategoriesConnectionEdge]
    }

    type SubcategoriesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: SubcategoryConnectionNode
    }

    # pagination extension types end here

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

        AND: [SubcategoryFilter]
        OR: [SubcategoryFilter]
    }

    type SubcategoryConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        categories: [CategorySummaryNode!]
        subjects: [SubjectSummaryNode!]
        programs: [ProgramSummaryNode!]
    }

    type CategorySummaryNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    extend type Query {
        subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
        subcategoriesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: SubcategoryFilter
            sort: SubcategorySortInput
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
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            SubcategoryConnectionNode: {
                categories: async (
                    subcategory: SubcategoryConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.subcategoriesConnection?.categories?.load(
                        subcategory.id
                    )
                },
                subjects: async (
                    subcategory: SubcategoryConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.subcategoriesConnection?.subjects?.load(
                        subcategory.id
                    )
                },
                programs: async (
                    subcategory: SubcategoryConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.subcategoriesConnection?.programs?.load(
                        subcategory.id
                    )
                },
            },
            Mutation: {
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                uploadSubCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubCategoriesFromCSV(args, ctx, info),
            },
            Query: {
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                subcategoriesConnection: (
                    _parent,
                    args,
                    ctx: Context,
                    _info
                ) => {
                    ctx.loaders.subcategoriesConnection = {
                        categories: new DataLoader((keys) =>
                            categoriesForSubcategories(keys)
                        ),
                        subjects: new DataLoader((keys) =>
                            subjectsForSubcategories(keys)
                        ),
                        programs: new DataLoader((keys) =>
                            programsForSubcategories(keys)
                        ),
                    }

                    return model.subcategoriesConnection(ctx, args)
                },
            },
        },
    }
}
