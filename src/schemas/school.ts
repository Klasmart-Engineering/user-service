import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        school(school_id: ID!): School
        uploadSchoolsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        school(school_id: ID!): School
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
`
export default function getDefault(
    model: Model,
    context?: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Mutation: {
                school: (_parent, args, _context, _info) =>
                    model.getSchool(args),
                uploadSchoolsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSchoolsFromCSV(args, ctx, info),
            },
            Query: {
                school: (_parent, args, _context, _info) =>
                    model.getSchool(args),
            },
        },
    }
}
