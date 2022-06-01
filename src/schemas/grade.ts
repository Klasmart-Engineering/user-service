import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { GradeConnectionNode } from '../types/graphQL/grade'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { mutate } from '../utils/mutations/commonStructure'
import { DeleteGrades } from '../resolvers/grade'

const typeDefs = gql`
    extend type Query {
        grade(id: ID!): Grade
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
            @isAdmin(entity: "grade")
        gradesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: GradeFilter
            sort: GradeSortInput
        ): GradesConnectionResponse @isAdmin(entity: "grade")
        gradeNode(id: ID!): GradeConnectionNode @isAdmin(entity: "grade")
    }

    extend type Mutation {
        grade(id: ID!): Grade @isAdmin(entity: "grade")
        uploadGradesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        renameDuplicateGrades: Boolean @isAdmin
        deleteGrades(input: [DeleteGradeInput!]!): GradesMutationResult
    }

    type GradeConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        fromGrade: GradeSummaryNode!
        toGrade: GradeSummaryNode!
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
            @deprecated(
                reason: "Sunset Date: 08/30/2022 Details: https://calmisland.atlassian.net/l/c/XopY1izU"
            )
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
        programId: UUIDFilter
        fromGradeId: UUIDFilter
        toGradeId: UUIDFilter

        AND: [GradeFilter!]
        OR: [GradeFilter!]
    }

    input GradeDetail {
        id: ID
        name: String
        progress_from_grade_id: ID
        progress_to_grade_id: ID
        system: Boolean
    }

    input DeleteGradeInput {
        id: ID!
    }

    type GradesMutationResult {
        grades: [GradeConnectionNode!]!
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            GradeConnectionNode: {
                fromGrade: async (
                    grade: GradeConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.gradesConnection.fromGrade.instance.load(
                        grade.id
                    )
                },
                toGrade: async (
                    grade: GradeConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.gradesConnection.toGrade.instance.load(
                        grade.id
                    )
                },
            },
            Mutation: {
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                uploadGradesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadGradesFromCSV(args, ctx, info),
                renameDuplicateGrades: (_parent, args, ctx, info) =>
                    model.renameDuplicateGrades(args, ctx, info),
                deleteGrades: (_parent, args, ctx) =>
                    mutate(DeleteGrades, args, ctx.permissions),
            },
            Query: {
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                gradesConnection: (_parent, args, ctx: Context, info) => {
                    return model.gradesConnection(ctx, info, args)
                },
                gradeNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.gradeNode.node.instance.load(args)
                },
            },
        },
    }
}
