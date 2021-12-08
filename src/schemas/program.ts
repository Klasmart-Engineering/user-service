import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { ProgramConnectionNode } from '../types/graphQL/program'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { GraphQLResolveInfo } from 'graphql'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { AgeRange } from '../entities/ageRange'

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
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        grades: [GradeSummaryNode!]
        subjects: [SubjectSummaryNode!]
        ageRangesConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection!
            filter: AgeRangeFilter
            sort: AgeRangeSortInput
        ): AgeRangesConnectionResponse
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
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        programNode(id: ID!): ProgramConnectionNode @isAdmin(entity: "program")
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
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
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
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            ProgramConnectionNode: {
                ageRanges: async (
                    program: ProgramConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.programsConnection.ageRanges.instance.load(
                        program.id
                    )
                },
                grades: async (
                    program: ProgramConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.programsConnection.grades.instance.load(
                        program.id
                    )
                },
                subjects: async (
                    program: ProgramConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.programsConnection.subjects.instance.load(
                        program.id
                    )
                },
                ageRangesConnection: ageRangesChildConnectionResolver,
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
                    return model.programsConnection(info, args)
                },
                programNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.programNode.node.instance.load(args)
                },
            },
        },
    }
}

export async function ageRangesChildConnectionResolver(
    program: Pick<ProgramConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadAgeRangesForProgram(ctx, program.id, args, includeTotalCount)
}

export async function loadAgeRangesForProgram(
    context: Pick<Context, 'loaders'>,
    programId: ProgramConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<AgeRange> = {
        args,
        includeTotalCount,
        parent: {
            id: programId,
            filterKey: 'programId',
            pivot: '"Program"."id"',
        },
        primaryColumn: 'id',
    }
    return context.loaders.ageRangesConnectionChild.instance.load(key)
}
