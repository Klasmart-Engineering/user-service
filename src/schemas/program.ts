import { GraphQLResolveInfo } from 'graphql'
import gql from 'graphql-tag'
import { AgeRange } from '../entities/ageRange'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { IDataLoaders } from '../loaders/setup'
import { Context } from '../main'
import { Model } from '../model'
import { ProgramConnectionNode } from '../types/graphQL/program'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { Subject } from '../entities/subject'
import { mutate } from '../utils/mutations/commonStructure'
import {
    CreatePrograms,
    UpdatePrograms,
    DeletePrograms,
} from '../resolvers/program'

const typeDefs = gql`
    extend type Mutation {
        program(id: ID!): Program @isAdmin(entity: "program")
        uploadProgramsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        createPrograms(input: [CreateProgramInput!]!): ProgramsMutationResult
        updatePrograms(input: [UpdateProgramInput!]!): ProgramsMutationResult
        deletePrograms(input: [DeleteProgramInput!]!): ProgramsMutationResult
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
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        subjects: [CoreSubjectConnectionNode!]
            @deprecated(
                reason: "Sunset Date: 07/03/2022 Details: https://calmisland.atlassian.net/l/c/Ts9fp60C"
            )

        subjectsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: SubjectFilter
            sort: SubjectSortInput
        ): SubjectsConnectionResponse

        gradesConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: GradeFilter
            sort: GradeSortInput
        ): GradesConnectionResponse

        ageRangesConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
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

    type CoreSubjectConnectionNode {
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
            @deprecated(
                reason: "Sunset Date: 28/04/2022 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
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

    # mutation types
    input CreateProgramInput {
        name: String!
        organizationId: ID!
        ageRangeIds: [ID!]!
        gradeIds: [ID!]!
        subjectIds: [ID!]!
    }

    input UpdateProgramInput {
        id: ID!
        name: String
        ageRangeIds: [ID!]
        gradeIds: [ID!]
        subjectIds: [ID!]
    }

    input DeleteProgramInput {
        id: ID!
    }

    type ProgramsMutationResult {
        programs: [ProgramConnectionNode!]!
    }
`

export async function subjectsChildConnectionResolver(
    program: Pick<ProgramConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSubjectsForProgram(ctx, program.id, args, includeTotalCount)
}

export async function loadSubjectsForProgram(
    context: Pick<Context, 'loaders'>,
    programId: ProgramConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Subject> = {
        args,
        includeTotalCount,
        parent: {
            id: programId,
            filterKey: 'programId',
            pivot: '"Program"."id"',
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
                subjectsConnection: subjectsChildConnectionResolver,
                gradesConnection: gradesChildConnectionResolver,
                ageRangesConnection: ageRangesChildConnectionResolver,
            },
            Mutation: {
                program: (_parent, args, ctx, _info) =>
                    model.getProgram(args, ctx),
                uploadProgramsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadProgramsFromCSV(args, ctx, info),
                createPrograms: (_parent, args, ctx) =>
                    mutate(CreatePrograms, args, ctx.permissions),
                updatePrograms: (_parent, args, ctx) =>
                    mutate(UpdatePrograms, args, ctx.permissions),
                deletePrograms: (_parent, args, ctx) =>
                    mutate(DeletePrograms, args, ctx.permissions),
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

export async function gradesChildConnectionResolver(
    program: Pick<ProgramConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadGradesForProgram(
        program.id,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

export async function loadGradesForProgram(
    programId: ProgramConnectionNode['id'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.gradesConnectionChild.instance.load({
        args,
        includeTotalCount,
        parent: {
            id: programId,
            filterKey: 'programId',
            pivot: '"Program"."id"',
        },
        primaryColumn: 'id',
    })
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
