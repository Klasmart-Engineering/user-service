import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'
import { SchoolMembership } from '../entities/schoolMembership'
import { School } from '../entities/school'

const typeDefs = gql`
    extend type Mutation {
        school(school_id: ID!): School
        uploadSchoolsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        school(school_id: ID!): School
            @deprecated(
                reason: "Use 'schoolsConnection' with 'schoolId' filter."
            )
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
        delete(_: Int): Boolean
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
    }

    input SchoolFilter {
        # table columns
        schoolId: UUIDFilter
        name: StringFilter
        shortCode: StringFilter
        status: StringFilter

        # joined columns
        organizationId: UUIDFilter

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
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Mutation: {
                school: (_parent, args, ctx, _info) =>
                    model.getSchool(args, ctx),
                uploadSchoolsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSchoolsFromCSV(args, ctx, info),
            },
            Query: {
                school: (_parent, args, ctx, _info) =>
                    model.getSchool(args, ctx),
                schoolsConnection: (_parent, args, ctx, info) => {
                    return model.schoolsConnection(ctx, info, args)
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
