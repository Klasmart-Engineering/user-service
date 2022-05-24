import gql from 'graphql-tag'
import { GraphQLResolveInfo } from 'graphql/type/definition'
import { IDataLoaders } from '../loaders/setup'
import { Context } from '../main'
import { Model } from '../model'
import { ClassConnectionNode } from '../types/graphQL/class'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { filterHasProperty } from '../utils/pagination/filtering'
import {
    IChildPaginationArgs,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'
import {
    DeleteClasses,
    AddProgramsToClasses,
    RemoveProgramsFromClasses,
    CreateClasses,
    UpdateClasses,
    AddStudentsToClasses,
    RemoveStudentsFromClasses,
    AddTeachersToClasses,
    RemoveTeachersFromClasses,
    SetAcademicTermsOfClasses,
    moveUsersToClass,
    moveUsersTypeToClass,
    AddAgeRangesToClasses,
    RemoveAgeRangesFromClasses,
    RemoveSubjectsFromClasses,
    AddSubjectsToClasses,
} from '../resolvers/class'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { Subject } from '../entities/subject'
import { Program } from '../entities/program'
import { AgeRange } from '../entities/ageRange'
import { mutate } from '../utils/mutations/commonStructure'
import { CoreClassConnectionNode } from '../pagination/classesConnection'
import { Class } from '../entities/class'

const typeDefs = gql`
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

    extend type Mutation {
        classes: [Class]
        class(class_id: ID!): Class
        uploadClassesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        createClasses(input: [CreateClassInput!]!): ClassesMutationResult
        updateClasses(input: [UpdateClassInput!]!): ClassesMutationResult
        deleteClasses(input: [DeleteClassInput!]!): ClassesMutationResult
        addProgramsToClasses(
            input: [AddProgramsToClassInput!]!
        ): ClassesMutationResult
        removeProgramsFromClasses(
            input: [RemoveProgramsFromClassInput!]!
        ): ClassesMutationResult
        addStudentsToClasses(
            input: [AddStudentsToClassInput!]!
        ): ClassesMutationResult
        removeStudentsFromClasses(
            input: [RemoveStudentsFromClassInput!]!
        ): ClassesMutationResult
        addTeachersToClasses(
            input: [AddTeachersToClassInput!]!
        ): ClassesMutationResult
        removeTeachersFromClasses(
            input: [RemoveTeachersFromClassInput!]!
        ): ClassesMutationResult
        addAgeRangesToClasses(
            input: [AddAgeRangesToClassInput!]!
        ): ClassesMutationResult
        removeAgeRangesFromClasses(
            input: [RemoveAgeRangesFromClassInput!]!
        ): ClassesMutationResult
        """
        Note: A null or undefined academicTermId will remove the AcademicTerm from the class
        """
        setAcademicTermsOfClasses(
            input: [SetAcademicTermOfClassInput!]!
        ): ClassesMutationResult
        moveStudentsToClass(
            input: MoveUsersToClassInput
        ): MoveUsersToClassMutationResult
        moveTeachersToClass(
            input: MoveUsersToClassInput
        ): MoveUsersToClassMutationResult
        removeSubjectsFromClasses(
            input: [RemoveSubjectsFromClassInput!]!
        ): ClassesMutationResult
        addSubjectsToClasses(
            input: [AddSubjectsToClassInput!]!
        ): ClassesMutationResult
    }

    type ClassConnectionNode {
        id: ID!
        name: String
        status: Status!
        shortCode: String
        schools: [SchoolSummaryNode!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
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
        programs: [CoreProgramConnectionNode!]
            @deprecated(
                reason: "Sunset Date: 01/03/22 Details: https://calmisland.atlassian.net/l/c/aaSJnmbQ"
            )

        academicTerm: AcademicTermConnectionNode

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

        subjectsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: SubjectFilter
            sort: SubjectSortInput
        ): SubjectsConnectionResponse

        programsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: ProgramFilter
            sort: ProgramSortInput
        ): ProgramsConnectionResponse

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
            direction: ConnectionDirection!
            filter: AgeRangeFilter
            sort: AgeRangeSortInput
        ): AgeRangesConnectionResponse
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
            @deprecated(
                reason: "Sunset Date: 31/03/2022 Details: [https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2478735554]"
            )
        eligibleStudents: [User]
            @deprecated(
                reason: "Sunset Date: 31/03/2022 Details: [https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2478735554]"
            )

        #mutations
        set(class_name: String, shortcode: String): Class
        addTeacher(user_id: ID!): User
        editTeachers(teacher_ids: [ID!]): [User]
        removeTeacher(user_id: ID!): Boolean
        addStudent(user_id: ID!): User
            @deprecated(
                reason: "Sunset Date: 24/04/2022 Details: https://calmisland.atlassian.net/l/c/av1p2bKY"
            )
        editStudents(student_ids: [ID!]): [User]
        removeStudent(user_id: ID!): Boolean
        editSchools(school_ids: [ID!]): [School]
        addSchool(school_id: ID!): School
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/l/c/av1p2bKY"
            )
        editPrograms(program_ids: [ID!]): [Program]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/l/c/av1p2bKY"
            )
        editAgeRanges(age_range_ids: [ID!]): [AgeRange]
        editGrades(grade_ids: [ID!]): [Grade]
        editSubjects(subject_ids: [ID!]): [Subject]
        removeSchool(school_id: ID!): Boolean

        delete(_: Int): Boolean
            @deprecated(reason: "Use deleteClasses() method")
        # addSchedule(id: ID!, timestamp: Date): Boolean
        # removeSchedule(id: ID!): Boolean
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

    input MoveUsersToClassInput {
        fromClassId: ID!
        toClassId: ID!
        userIds: [ID!]!
    }

    type MoveUsersToClassMutationResult {
        fromClass: ClassConnectionNode!
        toClass: ClassConnectionNode!
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
        academicTermId: UUIDExclusiveFilter

        #connections - extra filters
        studentId: UUIDFilter
        teacherId: UUIDFilter
        programId: UUIDFilter

        AND: [ClassFilter!]
        OR: [ClassFilter!]
    }

    type CoreProgramConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
    }

    # Mutation related definitions

    input DeleteClassInput {
        id: ID!
    }

    input CreateClassInput {
        organizationId: ID!
        name: String!
        shortcode: String
    }

    input UpdateClassInput {
        classId: ID!
        className: String
        shortcode: String
    }

    type ClassesMutationResult {
        classes: [ClassConnectionNode!]!
    }

    input AddProgramsToClassInput {
        classId: ID!
        programIds: [ID!]!
    }

    input RemoveProgramsFromClassInput {
        classId: ID!
        programIds: [ID!]!
    }

    input AddStudentsToClassInput {
        classId: ID!
        studentIds: [ID!]!
    }

    input RemoveStudentsFromClassInput {
        classId: ID!
        studentIds: [ID!]!
    }

    input AddTeachersToClassInput {
        classId: ID!
        teacherIds: [ID!]!
    }

    input RemoveTeachersFromClassInput {
        classId: ID!
        teacherIds: [ID!]!
    }

    input SetAcademicTermOfClassInput {
        classId: ID!
        academicTermId: ID
    }

    input AddAgeRangesToClassInput {
        classId: ID!
        ageRangeIds: [ID!]!
    }

    input RemoveAgeRangesFromClassInput {
        classId: ID!
        ageRangeIds: [ID!]!
    }

    input RemoveSubjectsFromClassInput {
        classId: ID!
        subjectIds: [ID!]!
    }

    input AddSubjectsToClassInput {
        classId: ID!
        subjectIds: [ID!]!
    }
`

export async function subjectsChildConnectionResolver(
    class_: Pick<ClassConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSubjectsForClass(ctx, class_.id, args, includeTotalCount)
}

export async function loadSubjectsForClass(
    context: Pick<Context, 'loaders'>,
    classId: ClassConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Subject> = {
        args,
        includeTotalCount,
        parent: {
            id: classId,
            filterKey: 'classId',
            pivot: '"Class"."class_id"',
        },
        primaryColumn: 'id',
    }

    return context.loaders.subjectsConnectionChild.instance.load(key)
}

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
        primaryColumn: 'school_id',
    })
}

export async function programsChildConnectionResolver(
    class_: Pick<ClassConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadProgramsForClass(ctx, class_.id, args, includeTotalCount)
}

export async function loadProgramsForClass(
    context: Pick<Context, 'loaders'>,
    classId: ClassConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Program> = {
        args,
        includeTotalCount,
        parent: {
            id: classId,
            filterKey: 'classId',
            pivot: '"Class"."class_id"',
        },
        primaryColumn: 'id',
    }

    return context.loaders.programsConnectionChild.instance.load(key)
}

export async function gradesChildConnectionResolver(
    class_: Pick<ClassConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadGradesForClass(class_.id, args, ctx.loaders, includeTotalCount)
}

export async function loadGradesForClass(
    classId: ClassConnectionNode['id'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.gradesConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: classId,
            filterKey: 'classId',
            pivot: '"Class"."class_id"',
        },
        primaryColumn: 'id',
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
                academicTerm: async (
                    classNode: CoreClassConnectionNode,
                    _args: Record<string, never>,
                    ctx: Context
                ) => {
                    return ctx.loaders.classesConnection.academicTerm.instance.load(
                        classNode.id
                    )
                },
                schoolsConnection: schoolsChildConnectionResolver,
                gradesConnection: gradesChildConnectionResolver,
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
                        primaryColumn: 'user_id',
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
                        primaryColumn: 'user_id',
                    })
                },
                subjectsConnection: subjectsChildConnectionResolver,
                programsConnection: programsChildConnectionResolver,
                ageRangesConnection: ageRangesChildConnectionResolver,
            },
            Class: {
                students: (parent: Class, _args, ctx: Context) =>
                    ctx.loaders.class.students.instance.load(parent.class_id),
                teachers: (parent: Class, _args, ctx: Context) =>
                    ctx.loaders.class.teachers.instance.load(parent.class_id),
            },
            Mutation: {
                deleteClasses: (_parent, args, ctx, _info) =>
                    mutate(DeleteClasses, args, ctx.permissions),
                createClasses: (_parent, args, ctx, _info) =>
                    mutate(CreateClasses, args, ctx.permissions),
                updateClasses: (_parent, args, ctx, _info) =>
                    mutate(UpdateClasses, args, ctx.permissions),
                classes: (_parent, _args, ctx) => model.getClasses(ctx),
                class: (_parent, args, ctx, _info) => model.getClass(args, ctx),
                uploadClassesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadClassesFromCSV(args, ctx, info),
                addProgramsToClasses: (_parent, args, ctx, _info) =>
                    mutate(AddProgramsToClasses, args, ctx.permissions),
                removeProgramsFromClasses: (_parent, args, ctx) =>
                    mutate(RemoveProgramsFromClasses, args, ctx.permissions),
                addStudentsToClasses: (_parent, args, ctx) =>
                    mutate(AddStudentsToClasses, args, ctx.permissions),
                removeStudentsFromClasses: (_parent, args, ctx) =>
                    mutate(RemoveStudentsFromClasses, args, ctx.permissions),
                addTeachersToClasses: (_parent, args, ctx) =>
                    mutate(AddTeachersToClasses, args, ctx.permissions),
                removeTeachersFromClasses: (_parent, args, ctx) =>
                    mutate(RemoveTeachersFromClasses, args, ctx.permissions),
                setAcademicTermsOfClasses: (_parent, args, ctx) =>
                    mutate(SetAcademicTermsOfClasses, args, ctx.permissions),
                moveStudentsToClass: (_parent, args, ctx) =>
                    moveUsersToClass(
                        ctx,
                        args.input,
                        moveUsersTypeToClass.students
                    ),
                moveTeachersToClass: (_parent, args, ctx) =>
                    moveUsersToClass(
                        ctx,
                        args.input,
                        moveUsersTypeToClass.teachers
                    ),
                addAgeRangesToClasses: (_parent, args, ctx, _info) =>
                    mutate(AddAgeRangesToClasses, args, ctx.permissions),
                removeAgeRangesFromClasses: (_parent, args, ctx, _info) =>
                    mutate(RemoveAgeRangesFromClasses, args, ctx.permissions),
                removeSubjectsFromClasses: (_parent, args, ctx) =>
                    mutate(RemoveSubjectsFromClasses, args, ctx.permissions),
                addSubjectsToClasses: (_parent, args, ctx) =>
                    mutate(AddSubjectsToClasses, args, ctx.permissions),
            },
            Query: {
                class: (_parent, args, ctx): Promise<Class | undefined> =>
                    model.getClass(args, ctx),
                classes: (_parent, _args, ctx) => model.getClasses(ctx),
                classesConnection: (_parent, args, _ctx: Context, info) => {
                    return model.classesConnection(info, args)
                },
                classNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.classNode.node.instance.load(args)
                },
            },
        },
    }
}

export async function ageRangesChildConnectionResolver(
    cl: Pick<ClassConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadAgeRangesForClass(ctx, cl.id, args, includeTotalCount)
}

export async function loadAgeRangesForClass(
    context: Pick<Context, 'loaders'>,
    classId: ClassConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<AgeRange> = {
        args,
        includeTotalCount,
        parent: {
            id: classId,
            filterKey: 'classId',
            pivot: '"Class"."class_id"',
        },
        primaryColumn: 'id',
    }
    return context.loaders.ageRangesConnectionChild.instance.load(key)
}
