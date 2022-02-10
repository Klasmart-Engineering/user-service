import gql from 'graphql-tag'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { Model } from '../model'
import { Context } from '../main'
import { SubjectConnectionNode } from '../types/graphQL/subject'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { GraphQLResolveInfo } from 'graphql'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { Category } from '../entities/category'
import { mutate } from '../utils/mutations/commonStructure'
import {
    CreateSubjects,
    UpdateSubjects,
    DeleteSubjects,
} from '../resolvers/subject'

const typeDefs = gql`
    extend type Mutation {
        subject(id: ID!): Subject @isAdmin(entity: "subject")
        uploadSubjectsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        renameDuplicateSubjects: Boolean @isAdmin
        createSubjects(input: [CreateSubjectInput!]!): SubjectsMutationResult
        updateSubjects(input: [UpdateSubjectInput!]!): SubjectsMutationResult
        deleteSubjects(input: [DeleteSubjectInput!]!): SubjectsMutationResult
    }

    # pagination extension types start here
    type SubjectsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [SubjectsConnectionEdge]
    }

    type SubjectsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: SubjectConnectionNode
    }

    # pagination extension types end here

    enum SubjectSortBy {
        id
        name
        system
    }

    input SubjectSortInput {
        field: SubjectSortBy!
        order: SortOrder!
    }

    input SubjectFilter {
        # table columns
        id: UUIDFilter
        name: StringFilter
        status: StringFilter
        system: BooleanFilter

        # joined columns
        organizationId: UUIDFilter
        categoryId: UUIDFilter
        classId: UUIDFilter
        programId: UUIDFilter

        AND: [SubjectFilter]
        OR: [SubjectFilter]
    }

    type SubjectConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        categories: [CategoryConnectionNode!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        categoriesConnection(
            count: PageSize
            cursor: String
            filter: CategoryFilter
            sort: CategorySortInput
            direction: ConnectionDirection
        ): CategoriesConnectionResponse
    }

    extend type Query {
        subject(id: ID!): Subject
            @deprecated(
                reason: "Sunset Date: 09/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
            @isAdmin(entity: "subject")
        subjectsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: SubjectFilter
            sort: SubjectSortInput
        ): SubjectsConnectionResponse @isAdmin(entity: "subject")
        subjectNode(id: ID!): SubjectConnectionNode @isAdmin(entity: "subject")
    }

    type Subject {
        id: ID!
        name: String!
        categories: [Category!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        subcategories: [Subcategory!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
            @deprecated(
                reason: "Sunset Date: 20/04/2022 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
    }

    input SubjectDetail {
        id: ID
        name: String
        categories: [ID!]
        system: Boolean
    }

    # mutation types
    input CreateSubjectInput {
        name: String!
        organizationId: ID!
        categoryIds: [ID!]
    }

    input UpdateSubjectInput {
        id: ID!
        name: String
        categoryIds: [ID!]
    }

    input DeleteSubjectInput {
        id: ID!
    }

    type SubjectsMutationResult {
        subjects: [SubjectConnectionNode!]!
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            SubjectConnectionNode: {
                categories: async (
                    subject: SubjectConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.subjectsConnection.categories.instance.load(
                        subject.id
                    )
                },
                categoriesConnection: categoriesConnectionResolver,
            },
            Mutation: {
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
                uploadSubjectsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubjectsFromCSV(args, ctx, info),
                renameDuplicateSubjects: (_parent, args, ctx, info) =>
                    model.renameDuplicateSubjects(args, ctx, info),
                createSubjects: (_parent, args, ctx) =>
                    mutate(CreateSubjects, args, ctx.permissions),
                updateSubjects: (_parent, args, ctx) =>
                    mutate(UpdateSubjects, args, ctx.permissions),
                deleteSubjects: (_parent, args, ctx) =>
                    mutate(DeleteSubjects, args, ctx.permissions),
            },
            Query: {
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
                subjectsConnection: (_parent, args, ctx: Context, info) => {
                    return model.subjectsConnection(ctx, info, args)
                },
                subjectNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.subjectNode.node.instance.load(args)
                },
            },
        },
    }
}

export async function categoriesConnectionResolver(
    subject: Pick<SubjectConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadCategoriesForSubject(ctx, subject.id, args, includeTotalCount)
}

export async function loadCategoriesForSubject(
    context: Pick<Context, 'loaders'>,
    subjectId: SubjectConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Category> = {
        args,
        includeTotalCount,
        parent: {
            id: subjectId,
            filterKey: 'subjectId',
            pivot: '"Subject"."id"',
        },
        primaryColumn: 'id',
    }
    return context.loaders.categoriesConnectionChild.instance.load(key)
}
