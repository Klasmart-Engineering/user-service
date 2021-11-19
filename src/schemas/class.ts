import gql from 'graphql-tag'
import Dataloader from 'dataloader'
import { GraphQLResolveInfo } from 'graphql/type/definition'

import { Model } from '../model'
import { Context } from '../main'
import {
    orgsForUsers,
    schoolsForUsers,
    rolesForUsers,
} from '../loaders/usersConnection'
import { IDataLoaders } from '../loaders/setup'
import { ClassConnectionNode } from '../types/graphQL/class'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { filterHasProperty } from '../utils/pagination/filtering'
import {
    IChildPaginationArgs,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'

const typeDefs = gql`
    extend type Mutation {
        classes: [Class]
        class(class_id: ID!): Class
        uploadClassesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    # pagination extension types start here
    type ClassesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [ClassesConnectionEdge]
    }

    type ClassesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: ClassConnectionNode
    }

    # pagination extension types end here

    enum ClassSortBy {
        id
        name
    }

    input ClassSortInput {
        field: ClassSortBy!
        order: SortOrder!
    }

    input ClassFilter {
        id: UUIDFilter
        name: StringFilter
        status: StringFilter

        #joined columns
        organizationId: UUIDFilter
        ageRangeValueFrom: AgeRangeValueFilter
        ageRangeUnitFrom: AgeRangeUnitFilter
        ageRangeValueTo: AgeRangeValueFilter
        ageRangeUnitTo: AgeRangeUnitFilter
        schoolId: UUIDExclusiveFilter
        gradeId: UUIDFilter
        subjectId: UUIDFilter
        programId: UUIDFilter

        AND: [ClassFilter!]
        OR: [ClassFilter!]

        #connections - extra filters
        studentId: UUIDFilter
        teacherId: UUIDFilter
    }

    type ClassConnectionNode {
        id: ID!
        name: String
        status: Status!
        shortCode: String
        schools: [SchoolSummaryNode!]
        ageRanges: [AgeRangeConnectionNode!]
        grades: [GradeSummaryNode!]
        subjects: [SubjectSummaryNode!]
        programs: [ProgramSummaryNode!]

        studentsConnection(
            count: PageSize
            cursor: String
            filter: UserFilter
            sort: UserSortInput
            direction: ConnectionDirection
        ): UsersConnectionResponse

        teachersConnection(
            count: PageSize
            cursor: String
            filter: UserFilter
            sort: UserSortInput
            direction: ConnectionDirection
        ): UsersConnectionResponse

        schoolsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: SchoolFilter
            sort: SchoolSortInput
        ): SchoolsConnectionResponse
    }

    type ProgramSummaryNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    extend type Query {
        classes: [Class] @deprecated(reason: "Use 'classesConnection'.")
        class(class_id: ID!): Class
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        classNode(id: ID!): ClassConnectionNode @isAdmin(entity: "class")
        classesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: ClassFilter
            sort: ClassSortInput
        ): ClassesConnectionResponse @isAdmin(entity: "class")
    }

    type Class {
        class_id: ID!

        #properties
        class_name: String
        status: Status
        shortcode: String
        #connections
        organization: Organization
        schools: [School]
        teachers: [User]
        students: [User]
        # schedule: [ScheduleEntry]

        # query
        programs: [Program!]
        age_ranges: [AgeRange!]
        grades: [Grade!]
        subjects: [Subject!]
        eligibleTeachers: [User]
        eligibleStudents: [User]

        #mutations
        set(class_name: String, shortcode: String): Class
        addTeacher(user_id: ID!): User
        editTeachers(teacher_ids: [ID!]): [User]
        removeTeacher(user_id: ID!): Boolean
        addStudent(user_id: ID!): User
        editStudents(student_ids: [ID!]): [User]
        removeStudent(user_id: ID!): Boolean
        editSchools(school_ids: [ID!]): [School]
        addSchool(school_id: ID!): School
        editPrograms(program_ids: [ID!]): [Program]
        editAgeRanges(age_range_ids: [ID!]): [AgeRange]
        editGrades(grade_ids: [ID!]): [Grade]
        editSubjects(subject_ids: [ID!]): [Subject]
        removeSchool(school_id: ID!): Boolean

        delete(_: Int): Boolean
        # addSchedule(id: ID!, timestamp: Date): Boolean
        # removeSchedule(id: ID!): Boolean
    }
`

export async function schoolsChildConnectionResolver(
    class_: Pick<ClassConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return schoolsChildConnection(class_, args, ctx.loaders, includeTotalCount)
}

//This method is split up from totalCount to be easily testable
export async function schoolsChildConnection(
    class_: Pick<ClassConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.schoolsConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: class_.id,
            filterKey: 'classId',
            pivot: '"Class"."class_id"',
        },
    })
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            ClassConnectionNode: {
                schools: async (
                    class_: ClassConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.classesConnection.schools.instance.load(
                        class_.id
                    )
                },
                ageRanges: async (
                    class_: ClassConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.classesConnection.ageRanges.instance.load(
                        class_.id
                    )
                },
                grades: async (
                    class_: ClassConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.classesConnection.grades.instance.load(
                        class_.id
                    )
                },
                subjects: async (
                    class_: ClassConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.classesConnection.subjects.instance.load(
                        class_.id
                    )
                },
                programs: async (
                    class_: ClassConnectionNode,
                    _args: Record<string, unknown>,
                    ctx: Context
                ) => {
                    return ctx.loaders.classesConnection.programs.instance.load(
                        class_.id
                    )
                },
                schoolsConnection: schoolsChildConnectionResolver,
                studentsConnection: async (
                    classNode: ClassConnectionNode,
                    args: IChildPaginationArgs,
                    ctx: Context,
                    info: GraphQLResolveInfo
                ) => {
                    // edge case since usersConnection supports multiple classId filters
                    if (filterHasProperty('classId', args.filter)) {
                        throw new Error(
                            'Cannot filter by classId on studentsConnection'
                        )
                    }
                    return ctx.loaders.usersConnectionChild.instance.load({
                        args,
                        includeTotalCount: shouldIncludeTotalCount(info, args),
                        parent: {
                            id: classNode.id,
                            filterKey: 'classStudyingId',
                            pivot: '"ClassStudying"."class_id"',
                        },
                    })
                },
                teachersConnection: async (
                    classNode: ClassConnectionNode,
                    args: IChildPaginationArgs,
                    ctx: Context,
                    info: GraphQLResolveInfo
                ) => {
                    // edge case since usersConnection supports multiple classId filters
                    if (filterHasProperty('classId', args.filter)) {
                        throw new Error(
                            'Cannot filter by classId on teachersConnection'
                        )
                    }
                    return ctx.loaders.usersConnectionChild.instance.load({
                        args,
                        includeTotalCount: shouldIncludeTotalCount(info, args),
                        parent: {
                            id: classNode.id,
                            filterKey: 'classTeachingId',
                            pivot: '"ClassTeaching"."class_id"',
                        },
                    })
                },
            },
            Mutation: {
                classes: (_parent, _args, ctx) => model.getClasses(ctx),
                class: (_parent, args, ctx, _info) => model.getClass(args, ctx),
                uploadClassesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadClassesFromCSV(args, ctx, info),
            },
            Query: {
                class: (_parent, args, ctx, _info) => model.getClass(args, ctx),
                classes: (_parent, _args, ctx) => model.getClasses(ctx),
                classesConnection: (_parent, args, ctx: Context, info) => {
                    // Add dataloaders for the usersConnection
                    // TODO remove once corresponding child connections have been created
                    ctx.loaders.usersConnection = {
                        organizations: new Dataloader((keys) =>
                            orgsForUsers(keys)
                        ),
                        schools: new Dataloader((keys) =>
                            schoolsForUsers(keys)
                        ),
                        roles: new Dataloader((keys) => rolesForUsers(keys)),
                    }
                    return model.classesConnection(info, args)
                },
                classNode: (_parent, args, ctx: Context) => {
                    // Add dataloaders for the usersConnection
                    // TODO remove once corresponding child connections have been created
                    ctx.loaders.usersConnection = {
                        organizations: new Dataloader((keys) =>
                            orgsForUsers(keys)
                        ),
                        schools: new Dataloader((keys) =>
                            schoolsForUsers(keys)
                        ),
                        roles: new Dataloader((keys) => rolesForUsers(keys)),
                    }
                    return ctx.loaders.classNode.node.instance.load(args)
                },
            },
        },
    }
}
