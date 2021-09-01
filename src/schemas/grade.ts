import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { GradeConnectionNode } from '../types/graphQL/gradeConnectionNode'
import {
    fromGradeForGrades,
    toGradeForGrades,
} from '../loaders/gradesConnection'

import Dataloader from 'dataloader'

const typeDefs = gql`
    extend type Mutation {
        grade(id: ID!): Grade @isAdmin(entity: "grade")
        uploadGradesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        renameDuplicateGrades: Boolean @isAdmin
    }

    # pagination exyension types start here
    type GradesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [GradesConnectionEdge]
    }

    type GradesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: GradeConnectionNode
    }

    # pagination extension types end here

    enum GradeSortBy {
        id
        name
    }

    input GradeSortInput {
        field: [GradeSortBy!]!
        order: SortOrder!
    }

    input GradeFilter {
        # table columns
        id: UUIDFilter
        name: StringFilter
        status: StringFilter
        system: BooleanFilter

        #joined columns
        organizationId: UUIDFilter
        fromGradeId: UUIDFilter
        toGradeId: UUIDFilter

        AND: [GradeFilter!]
        OR: [GradeFilter!]
    }

    type GradeConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        fromGrade: GradeSummaryNode!
        toGrade: GradeSummaryNode!
    }

    extend type Query {
        grade(id: ID!): Grade @isAdmin(entity: "grade")
        gradesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: GradeFilter
            sort: GradeSortInput
        ): GradesConnectionResponse @isAdmin(entity: "grade")
    }

    type Grade {
        id: ID!
        name: String!
        progress_from_grade: Grade
        progress_to_grade: Grade
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }
    input GradeDetail {
        id: ID
        name: String
        progress_from_grade_id: ID
        progress_to_grade_id: ID
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
            GradeConnectionNode: {
                fromGrade: async (
                    grade: GradeConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.gradesConnection?.fromGrade?.load(
                        grade.id
                    )
                },
                toGrade: async (
                    grade: GradeConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.gradesConnection?.toGrade?.load(grade.id)
                },
            },
            Mutation: {
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                uploadGradesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadGradesFromCSV(args, ctx, info),
                renameDuplicateGrades: (_parent, args, ctx, info) =>
                    model.renameDuplicateGrades(args, ctx, info),
            },
            Query: {
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                gradesConnection: (_parent, args, ctx: Context, _info) => {
                    ctx.loaders.gradesConnection = {
                        fromGrade: new Dataloader((keys) =>
                            fromGradeForGrades(keys)
                        ),
                        toGrade: new Dataloader((keys) =>
                            toGradeForGrades(keys)
                        ),
                    }

                    return model.gradesConnection(ctx, args)
                },
            },
        },
    }
}
