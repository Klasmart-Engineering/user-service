import gql from 'graphql-tag'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { Model } from '../model'
import { Context } from '../main'
import { SubjectConnectionNode } from '../types/graphQL/subject'

const typeDefs = gql`
    extend type Mutation {
        subject(id: ID!): Subject @isAdmin(entity: "subject")
        uploadSubjectsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        renameDuplicateSubjects: Boolean @isAdmin
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

        AND: [SubjectFilter]
        OR: [SubjectFilter]
    }

    type SubjectConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        categories: [CategoryConnectionNode!]
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
        subcategories: [Subcategory!]
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }

    input SubjectDetail {
        id: ID
        name: String
        categories: [ID!]
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
            },
            Mutation: {
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
                uploadSubjectsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubjectsFromCSV(args, ctx, info),
                renameDuplicateSubjects: (_parent, args, ctx, info) =>
                    model.renameDuplicateSubjects(args, ctx, info),
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
