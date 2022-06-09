import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import {
    DeleteCategories,
    CreateCategories,
    UpdateCategories,
    AddSubcategoriesToCategories,
    RemoveSubcategoriesFromCategories,
} from '../resolvers/category'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { mutate } from '../utils/resolvers/commonStructure'
import { CategoryConnectionNode } from '../types/graphQL/category'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { GraphQLResolveInfo } from 'graphql'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { Subject } from '../entities/subject'
import { Subcategory } from '../entities/subcategory'

const typeDefs = gql`
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

    extend type Mutation {
        category(id: ID!): Category
            @isAdmin(entity: "category")
            @deprecated(
                reason: "Sunset Date: 24/02/2022 Details: [https://calmisland.atlassian.net/l/c/RKcPTt1p, https://calmisland.atlassian.net/l/c/mTni58mA]"
            )
        uploadCategoriesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        createCategories(
            input: [CreateCategoryInput!]!
        ): CategoriesMutationResult
        deleteCategories(
            input: [DeleteCategoryInput!]!
        ): CategoriesMutationResult
        updateCategories(
            input: [UpdateCategoryInput!]!
        ): CategoriesMutationResult
        addSubcategoriesToCategories(
            input: [AddSubcategoriesToCategoryInput!]!
        ): CategoriesMutationResult
        removeSubcategoriesFromCategories(
            input: [RemoveSubcategoriesFromCategoryInput!]!
        ): CategoriesMutationResult
    }

    type CategoryConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!

        subjectsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: SubjectFilter
            sort: SubjectSortInput
        ): SubjectsConnectionResponse

        subcategoriesConnection(
            count: PageSize
            cursor: String
            filter: SubcategoryFilter
            sort: SubcategorySortInput
            direction: ConnectionDirection
        ): SubcategoriesConnectionResponse
    }

    type Category {
        id: ID!
        name: String!
        subcategories: [Subcategory!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        system: Boolean!
        status: Status

        # Mutations
        editSubcategories(subcategory_ids: [ID!]): [Subcategory]
            @deprecated(
                reason: "Sunset Date: 22/02/2022 Details: https://calmisland.atlassian.net/l/c/U107XwHS"
            )
        delete(_: Int): Boolean
            @deprecated(
                reason: "Sunset Date: 24/02/2022 Details: https://calmisland.atlassian.net/l/c/mTni58mA"
            )
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

    input CreateCategoryInput {
        name: String!
        organizationId: ID!
        subcategoryIds: [ID!]
    }

    input DeleteCategoryInput {
        id: ID!
    }

    input UpdateCategoryInput {
        id: ID!
        name: String
        subcategoryIds: [ID!]
    }

    type CategoriesMutationResult {
        categories: [CategoryConnectionNode!]!
    }

    input AddSubcategoriesToCategoryInput {
        categoryId: ID!
        subcategoryIds: [ID!]!
    }

    input RemoveSubcategoriesFromCategoryInput {
        categoryId: ID!
        subcategoryIds: [ID!]!
    }

    input CategoryDetail {
        id: ID
        name: String
        subcategories: [ID!]
        system: Boolean
    }
`

export async function subjectsChildConnectionResolver(
    category: Pick<CategoryConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSubjectsForCategory(ctx, category.id, args, includeTotalCount)
}

export async function loadSubjectsForCategory(
    context: Pick<Context, 'loaders'>,
    categoryId: CategoryConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Subject> = {
        args,
        includeTotalCount,
        parent: {
            id: categoryId,
            filterKey: 'categoryId',
            pivot: '"Category"."id"',
        },
        primaryColumn: 'id',
    }

    return context.loaders.subjectsConnectionChild.instance.load(key)
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            CategoryConnectionNode: {
                subjectsConnection: subjectsChildConnectionResolver,
                subcategoriesConnection: subcategoriesConnectionResolver,
            },
            Mutation: {
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
                uploadCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadCategoriesFromCSV(args, ctx, info),
                createCategories: (_parent, args, ctx, _info) =>
                    mutate(CreateCategories, args, ctx.permissions),
                deleteCategories: (_parent, args, ctx, _info) =>
                    mutate(DeleteCategories, args, ctx.permissions),
                updateCategories: (_parent, args, ctx, _info) =>
                    mutate(UpdateCategories, args, ctx.permissions),
                addSubcategoriesToCategories: (_parent, args, ctx) =>
                    mutate(AddSubcategoriesToCategories, args, ctx.permissions),
                removeSubcategoriesFromCategories: (_parent, args, ctx) =>
                    mutate(
                        RemoveSubcategoriesFromCategories,
                        args,
                        ctx.permissions
                    ),
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

export async function subcategoriesConnectionResolver(
    category: Pick<CategoryConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSubcategoriesForCategory(
        ctx,
        category.id,
        args,
        includeTotalCount
    )
}

export async function loadSubcategoriesForCategory(
    context: Pick<Context, 'loaders'>,
    categoryId: CategoryConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Subcategory> = {
        args,
        includeTotalCount,
        parent: {
            id: categoryId,
            filterKey: 'categoryId',
            pivot: '"Category"."id"',
        },
        primaryColumn: 'id',
    }
    return context.loaders.subcategoriesConnectionChild.instance.load(key)
}
