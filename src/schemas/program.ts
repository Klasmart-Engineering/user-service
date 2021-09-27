import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { ProgramConnectionNode } from '../types/graphQL/programConnectionNode'
import { Context } from '../main'
import {
    ageRangesForPrograms,
    gradesForPrograms,
    subjectsForPrograms,
} from '../loaders/programsConnection'
import Dataloader from 'dataloader'

const typeDefs = gql`
    extend type Mutation {
        program(id: ID!): Program @isAdmin(entity: "program")

        uploadProgramsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    # pagination extension types start here
    type ProgramsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [ProgramsConnectionEdge]
    }

    type ProgramsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: ProgramConnectionNode
    }

    # pagination extension types end here

    enum ProgramSortBy {
        id
        name
    }

    input ProgramSortInput {
        field: [ProgramSortBy!]!
        order: SortOrder!
    }

    input ProgramFilter {
        # table columns
        id: UUIDFilter
        name: StringFilter
        status: StringFilter
        system: BooleanFilter

        #joined columns
        organizationId: UUIDFilter
        gradeId: UUIDFilter
        ageRangeFrom: AgeRangeTypeFilter
        ageRangeTo: AgeRangeTypeFilter
        subjectId: UUIDFilter
        schoolId: UUIDFilter
        classId: UUIDFilter

        AND: [ProgramFilter!]
        OR: [ProgramFilter!]
    }

    type ProgramConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        ageRanges: [AgeRangeConnectionNode!]
        grades: [GradeSummaryNode!]
        subjects: [SubjectSummaryNode!]
    }

    type GradeSummaryNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    type SubjectSummaryNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    extend type Query {
        program(id: ID!): Program
            @isAdmin(entity: "program")
            @deprecated(reason: "Use 'programsConnection' with 'id' filter.")
        programsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: ProgramFilter
            sort: ProgramSortInput
        ): ProgramsConnectionResponse @isAdmin(entity: "program")
    }

    type Program {
        id: ID!
        name: String!
        system: Boolean!
        status: Status
        age_ranges: [AgeRange!]
        grades: [Grade!]
        subjects: [Subject!]

        # Mutations
        editAgeRanges(age_range_ids: [ID!]): [AgeRange]
        editGrades(grade_ids: [ID!]): [Grade]
        editSubjects(subject_ids: [ID!]): [Subject]

        delete(_: Int): Boolean
    }
    input ProgramDetail {
        id: ID
        name: String
        system: Boolean
        age_ranges: [ID!]
        grades: [ID!]
        subjects: [ID!]
        status: Status
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            ProgramConnectionNode: {
                ageRanges: async (
                    program: ProgramConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.programsConnection?.ageRanges?.load(
                        program.id
                    )
                },
                grades: async (
                    program: ProgramConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.programsConnection?.grades?.load(
                        program.id
                    )
                },
                subjects: async (
                    program: ProgramConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.programsConnection?.subjects?.load(
                        program.id
                    )
                },
            },
            Mutation: {
                program: (_parent, args, ctx, _info) =>
                    model.getProgram(args, ctx),
                uploadProgramsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadProgramsFromCSV(args, ctx, info),
            },
            Query: {
                program: (_parent, args, ctx, _info) =>
                    model.getProgram(args, ctx),
                programsConnection: (_parent, args, ctx: Context, info) => {
                    ctx.loaders.programsConnection = {
                        ageRanges: new Dataloader((keys) =>
                            ageRangesForPrograms(keys)
                        ),

                        grades: new Dataloader((keys) =>
                            gradesForPrograms(keys)
                        ),

                        subjects: new Dataloader((keys) =>
                            subjectsForPrograms(keys)
                        ),
                    }

                    return model.programsConnection(ctx, info, args)
                },
            },
        },
    }
}
