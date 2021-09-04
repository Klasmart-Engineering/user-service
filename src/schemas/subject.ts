import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { SubjectConnectionNode } from '../types/graphQL/subjectConnectionNode'
import DataLoader from 'dataloader'
import { categoriesForSubjects } from '../loaders/subjectsConnection'

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
        status: StringFilter
        system: BooleanFilter

        # joined columns
        organizationId: UUIDFilter

        AND: [SubjectFilter]
        OR: [SubjectFilter]
    }

    type SubjectConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        categories: [CategorySummaryNode!]
        programs: [ProgramSummaryNode!]
    }

    type CategorySummaryNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    extend type Query {
        subject(id: ID!): Subject @isAdmin(entity: "subject")
        subjectsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: SubjectFilter
            sort: SubjectSortInput
        ): SubjectsConnectionResponse @isAdmin(entity: "subject")
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
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            SubjectConnectionNode: {
                categories: async (
                    subject: SubjectConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.subjectsConnection?.categories?.load(
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
                subjectsConnection: (_parent, args, ctx: Context, _info) => {
                    ctx.loaders.subjectsConnection = {
                        categories: new DataLoader((keys) =>
                            categoriesForSubjects(keys)
                        ),
                    }

                    return model.subjectsConnection(ctx, args)
                },
            },
        },
    }
}
