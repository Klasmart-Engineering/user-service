import gql from 'graphql-tag'
import { GraphQLResolveInfo } from 'graphql'
import { Model } from '../model'
import { Context } from '../main'

import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { IDataLoaders } from '../loaders/setup'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { ISchoolsConnectionNode } from '../types/graphQL/school'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { Program } from '../entities/program'
import {
    AddClassesToSchools,
    AddProgramsToSchools,
    AddUsersToSchools,
    RemoveProgramsFromSchools,
} from '../resolvers/school'
import {
    CreateSchools,
    DeleteSchools,
    UpdateSchools,
    RemoveUsersFromSchools,
} from '../resolvers/school'
import { mutate } from '../utils/mutations/commonStructure'

const typeDefs = gql`
    extend type Mutation {
        school(school_id: ID!): School
        uploadSchoolsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        createSchools(input: [CreateSchoolInput!]!): SchoolsMutationResult
        updateSchools(input: [UpdateSchoolInput!]!): SchoolsMutationResult
        deleteSchools(input: [DeleteSchoolInput!]!): SchoolsMutationResult
        addUsersToSchools(
            input: [AddUsersToSchoolInput!]!
        ): SchoolsMutationResult
        removeUsersFromSchools(
            input: [RemoveUsersFromSchoolInput!]!
        ): SchoolsMutationResult
        addClassesToSchools(
            input: [AddClassesToSchoolInput!]!
        ): SchoolsMutationResult
        addProgramsToSchools(
            input: [AddProgramsToSchoolInput!]!
        ): SchoolsMutationResult
        removeProgramsFromSchools(
            input: [RemoveProgramsFromSchoolInput!]!
        ): SchoolsMutationResult
    }
    extend type Query {
        school(school_id: ID!): School
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        schoolNode(id: ID!): SchoolConnectionNode @isAdmin(entity: "school")
        schoolsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: SchoolFilter
            sort: SchoolSortInput
        ): SchoolsConnectionResponse @isAdmin(entity: "school")
    }
    type School {
        school_id: ID!

        #properties
        school_name: String
        shortcode: String
        status: Status

        #connections
        organization: Organization
        memberships: [SchoolMembership]
        membership(user_id: ID!): SchoolMembership
        classes: [Class]
        programs: [Program!]

        #mutations
        set(school_name: String, shortcode: String): School
        addUser(user_id: ID!): SchoolMembership
        editPrograms(program_ids: [ID!]): [Program]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/l/c/av1p2bKY"
            )
        delete(_: Int): Boolean
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/l/c/av1p2bKY"
            )
    }
    type SchoolMembership {
        #properties
        user_id: ID!
        school_id: ID!
        join_timestamp: Date
        status: Status

        #connections
        user: User
        school: School
        roles: [Role]

        #query
        checkAllowed(permission_name: ID!): Boolean

        #mutations
        addRole(role_id: ID!): Role
        addRoles(role_ids: [ID!]!): [Role]
        removeRole(role_id: ID!): SchoolMembership
        leave(_: Int): Boolean
            @deprecated(
                reason: "Sunset Date: 21/03/22 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
    }
    type MembershipUpdate {
        user: User
        membership: OrganizationMembership
        schoolMemberships: [SchoolMembership]
    }

    # pagination, filtering & sorting types
    type SchoolsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [SchoolsConnectionEdge]
    }

    type SchoolsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: SchoolConnectionNode
    }

    type SchoolConnectionNode {
        id: ID!
        name: String!
        status: Status!
        shortCode: String
        organizationId: ID!

        schoolMembershipsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: SchoolMembershipFilter
            sort: SchoolMembershipSortInput
        ): SchoolMembershipsConnectionResponse

        classesConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: ClassFilter
            sort: ClassSortInput
        ): ClassesConnectionResponse

        programsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: ProgramFilter
            sort: ProgramSortInput
        ): ProgramsConnectionResponse
    }

    input AddClassesToSchoolInput {
        schoolId: ID!
        classIds: [ID!]!
    }

    input AddProgramsToSchoolInput {
        schoolId: ID!
        programIds: [ID!]!
    }

    input SchoolFilter {
        # table columns
        schoolId: UUIDFilter
        name: StringFilter
        shortCode: StringFilter
        status: StringFilter

        # joined columns
        organizationId: UUIDFilter
        userId: UUIDFilter

        #connections - extra filters
        programId: UUIDFilter

        AND: [SchoolFilter!]
        OR: [SchoolFilter!]
    }

    enum SchoolSortBy {
        id
        name
        shortCode
    }

    input SchoolSortInput {
        field: [SchoolSortBy!]!
        order: SortOrder!
    }

    # Mutation related definitions
    input CreateSchoolInput {
        name: String!
        shortCode: String
        organizationId: String!
    }

    input UpdateSchoolInput {
        id: ID!
        organizationId: ID!
        name: String!
        shortCode: String!
    }

    input DeleteSchoolInput {
        id: ID!
    }

    input AddUsersToSchoolInput {
        schoolId: ID!
        schoolRoleIds: [ID!]!
        userIds: [ID!]!
    }

    input RemoveUsersFromSchoolInput {
        schoolId: ID!
        userIds: [ID!]!
    }

    type SchoolsMutationResult {
        schools: [SchoolConnectionNode!]!
    }

    input RemoveProgramsFromSchoolInput {
        schoolId: ID!
        programIds: [ID!]!
    }
`

// This is a workaround to needing to mock total count AST check in tests
export async function classesChildConnectionResolver(
    school: Pick<ISchoolsConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return classesChildConnection(school, args, ctx.loaders, includeTotalCount)
}

export function classesChildConnection(
    school: Pick<ISchoolsConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.classesConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: school.id,
            filterKey: 'schoolId',
            pivot: '"School"."school_id"',
        },
        primaryColumn: 'class_id',
    })
}

export async function programsChildConnectionResolver(
    school: Pick<ISchoolsConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadProgramsForSchool(ctx, school.id, args, includeTotalCount)
}

export async function loadProgramsForSchool(
    context: Pick<Context, 'loaders'>,
    schoolId: ISchoolsConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Program> = {
        args,
        includeTotalCount,
        parent: {
            id: schoolId,
            filterKey: 'schoolId',
            pivot: '"School"."school_id"',
        },
        primaryColumn: 'id',
    }

    return context.loaders.programsConnectionChild.instance.load(key)
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            SchoolConnectionNode: {
                schoolMembershipsConnection: schoolMembershipsConnectionResolver,
                classesConnection: classesChildConnectionResolver,
                programsConnection: programsChildConnectionResolver,
            },
            Mutation: {
                school: (_parent, args, ctx, _info) =>
                    model.getSchool(args, ctx),
                uploadSchoolsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSchoolsFromCSV(args, ctx, info),
                deleteSchools: (_parent, args, ctx, _info) =>
                    mutate(DeleteSchools, args, ctx.permissions),
                addClassesToSchools: (_parent, args, ctx, _info) =>
                    mutate(AddClassesToSchools, args, ctx.permissions),
                addProgramsToSchools: (_parent, args, ctx, _info) =>
                    mutate(AddProgramsToSchools, args, ctx.permissions),
                createSchools: (_parent, args, ctx, _info) =>
                    mutate(CreateSchools, args, ctx.permissions),
                updateSchools: (_parent, args, ctx, _info) =>
                    mutate(UpdateSchools, args, ctx.permissions),
                addUsersToSchools: (_parent, args, ctx, _info) =>
                    mutate(AddUsersToSchools, args, ctx.permissions),
                removeUsersFromSchools: (_parent, args, ctx, _info) =>
                    mutate(RemoveUsersFromSchools, args, ctx.permissions),
                removeProgramsFromSchools: (_parent, args, ctx, _info) =>
                    mutate(RemoveProgramsFromSchools, args, ctx.permissions),
            },
            Query: {
                school: (_parent, args, ctx, _info) =>
                    model.getSchool(args, ctx),
                schoolsConnection: (_parent, args, ctx, info) => {
                    return model.schoolsConnection(ctx, info, args)
                },
                schoolNode: (_parent, args, ctx, _info) => {
                    return ctx.loaders.schoolNode.instance.load(args)
                },
            },
            SchoolMembership: {
                school: (
                    schoolMembership: SchoolMembership,
                    _args,
                    ctx: Context,
                    info
                ) => {
                    return ctx.loaders.school.schoolById.instance.load(
                        schoolMembership.school_id
                    )
                },
            },
            School: {
                organization: (school: School, _args, ctx: Context, info) => {
                    return ctx.loaders.school.organization.instance.load(
                        school.school_id
                    )
                },
            },
        },
    }
}

export async function schoolMembershipsConnectionResolver(
    school: Pick<ISchoolsConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSchoolMembershipsForSchool(
        ctx,
        school.id,
        args,
        includeTotalCount
    )
}

export async function loadSchoolMembershipsForSchool(
    context: Pick<Context, 'loaders'>,
    schoolId: ISchoolsConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<SchoolMembership> = {
        args,
        includeTotalCount,
        parent: {
            id: schoolId,
            filterKey: 'schoolId',
            pivot: '"SchoolMembership"."school_id"',
        },
        primaryColumn: 'user_id',
    }

    return context.loaders.schoolMembershipsConnectionChild.instance.load(key)
}
