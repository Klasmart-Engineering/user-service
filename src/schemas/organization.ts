import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        organization(
            organization_id: ID!
            organization_name: String
            address1: String
            address2: String
            phone: String
            shortCode: String
        ): Organization
        uploadOrganizationsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        organization(organization_id: ID!): Organization
        organizations(organization_ids: [ID!]): [Organization]
            @isAdmin(entity: "organization")
        organizations_v1(
            organization_ids: [ID!]
            after: String
            before: String
            first: Int
            last: Int
        ): OrganizationConnection! @isAdmin(entity: "organization")
    }
    type Organization {
        organization_id: ID!

        #properties
        organization_name: String
        address1: String
        address2: String
        phone: String
        shortCode: String
        status: Status

        #connections

        """
        'owner' is the User that created this Organization
        """
        owner: User @deprecated(reason: "Use 'organization_ownerships'.")
        primary_contact: User
        roles: [Role]
        memberships: [OrganizationMembership]
        teachers: [OrganizationMembership]
        students: [OrganizationMembership]
        schools: [School]
        classes: [Class]
        ageRanges: [AgeRange!]
        grades: [Grade!]
        categories: [Category!]
        subcategories: [Subcategory!]
        subjects: [Subject!]
        programs: [Program!]

        #query
        membersWithPermission(
            permission_name: String!
            search_query: String
        ): [OrganizationMembership]
        findMembers(search_query: String!): [OrganizationMembership]

        #mutations
        set(
            organization_name: String
            address1: String
            address2: String
            phone: String
            shortCode: String
        ): Organization
        setPrimaryContact(user_id: ID!): User
        addUser(user_id: ID!, shortcode: String): OrganizationMembership
        inviteUser(
            email: String
            phone: String
            given_name: String
            family_name: String
            date_of_birth: String
            username: String
            gender: String
            shortcode: String
            organization_role_ids: [ID!]
            school_ids: [ID!]
            school_role_ids: [ID!]
            alternate_email: String
            alternate_phone: String
        ): MembershipUpdate
        editMembership(
            user_id: ID
            email: String
            phone: String
            given_name: String
            family_name: String
            date_of_birth: String
            username: String
            gender: String
            shortcode: String
            organization_role_ids: [ID!]
            school_ids: [ID!]
            school_role_ids: [ID!]
            alternate_email: String
            alternate_phone: String
        ): MembershipUpdate
        createRole(role_name: String!, role_description: String!): Role
        createSchool(school_name: String, shortcode: String): School
        createClass(class_name: String, shortcode: String): Class
        createOrUpdateAgeRanges(age_ranges: [AgeRangeDetail]!): [AgeRange]
        createOrUpdateGrades(grades: [GradeDetail]!): [Grade]
        createOrUpdateCategories(categories: [CategoryDetail]!): [Category]
        createOrUpdateSubcategories(
            subcategories: [SubcategoryDetail]!
        ): [Subcategory]
        createOrUpdateSubjects(subjects: [SubjectDetail]!): [Subject]
        createOrUpdatePrograms(programs: [ProgramDetail]!): [Program]
        delete(_: Int): Boolean
    }
    type OrganizationConnection {
        total: Int
        edges: [Organization]!
        pageInfo: PageInfo!
    }
    type OrganizationMembership {
        #properties
        user_id: ID!
        organization_id: ID!
        shortcode: String
        join_timestamp: Date
        status: Status

        #connections
        organization: Organization
        user: User
        roles: [Role]
        classes: [Class]
        schoolMemberships(permission_name: String): [SchoolMembership]

        #query
        checkAllowed(permission_name: ID!): Boolean
        classesTeaching: [Class]

        #mutations
        addRole(role_id: ID!): Role
        addRoles(role_ids: [ID!]!): [Role]
        removeRole(role_id: ID!): OrganizationMembership
        leave(_: Int): Boolean
    }
    type OrganizationOwnership {
        #properties
        user_id: ID!
        organization_id: ID!
        status: Status

        #connections
        organization: Organization
        user: User
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
                organization: (_parent, args, _context, _info) =>
                    model.setOrganization(args),
                uploadOrganizationsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadOrganizationsFromCSV(args, ctx, info),
            },
            Query: {
                organizations: (_parent, args, _context, _info) =>
                    model.getOrganizations(args),
                organization: (_parent, { organization_id }, _context, _info) =>
                    model.getOrganization(organization_id),
                organizations_v1: (_parent, args, ctx, _info) =>
                    model.v1_getOrganizations(ctx, args),
            },
        },
    }
}
