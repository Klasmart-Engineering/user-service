import { ApolloServerExpressConfig } from 'apollo-server-express'
import Dataloader from 'dataloader'
import { GraphQLResolveInfo } from 'graphql'
import gql from 'graphql-tag'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import {
    orgsForUsers,
    schoolsForUsers,
    rolesForUsers,
} from '../loaders/usersConnection'
import { Context } from '../main'
import { Model } from '../model'
import { OrganizationConnectionNode } from '../types/graphQL/organization'
import { addUsersToOrganizations } from '../resolvers/organization'
import {
    IChildPaginationArgs,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'

const typeDefs = gql`
    scalar HexColor
    scalar Url

    extend type Mutation {
        addUsersToOrganizations(
            input: [AddUsersToOrganizationInput!]!
        ): OrganizationsMutationResult
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
        renameDuplicateOrganizations: Boolean @isAdmin
        setBranding(
            organizationId: ID!
            iconImage: Upload
            primaryColor: HexColor
        ): Branding
        deleteBrandingImage(
            organizationId: ID!
            type: BrandingImageTag!
        ): Boolean
        deleteBrandingColor(organizationId: ID!): Boolean
    }
    extend type Query {
        organization(organization_id: ID!): Organization
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        organizations(organization_ids: [ID!]): [Organization]
            @deprecated(reason: "Use 'organizationsConnection'.")
            @isAdmin(entity: "organization")
        organizationsConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: OrganizationFilter
            sort: OrganizationSortInput
        ): OrganizationsConnectionResponse @isAdmin(entity: "organization")
        organizationNode(id: ID!): OrganizationConnectionNode
            @isAdmin(entity: "organization")
    }

    # DB Entities

    type Organization {
        organization_id: ID!

        #properties
        organization_name: String
        address1: String
        address2: String
        phone: String
        shortCode: String
        status: Status

        branding: Branding

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
        classes: [Class] @deprecated(reason: "Use 'getClasses'.")
        getClasses: [Class]
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
            @deprecated(
                reason: "Sunset Date: 01/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2419261457/"
            )
        inviteUser(
            email: String
            phone: String
            given_name: String!
            family_name: String!
            date_of_birth: String
            username: String
            gender: String!
            shortcode: String
            organization_role_ids: [ID!]!
            school_ids: [ID!]
            school_role_ids: [ID!]
            alternate_email: String
            alternate_phone: String
        ): MembershipUpdate
        editMembership(
            user_id: ID!
            given_name: String!
            family_name: String!
            # email and phone are deprecated. Use User.set instead.
            email: String
            phone: String
            date_of_birth: String
            username: String
            gender: String!
            shortcode: String!
            organization_role_ids: [ID!]!
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
            @deprecated(
                reason: "Use User.classesStudying and User.classesTeaching"
            )
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

    type Branding {
        iconImageURL: Url
        primaryColor: HexColor
    }

    enum BrandingImageTag {
        ICON
    }

    # Mutation related definitions

    input AddUsersToOrganizationInput {
        organizationId: ID!
        organizationRoleIds: [ID!]!
        userIds: [ID!]!
        shortcode: String
    }

    type OrganizationsMutationResult {
        organizations: [OrganizationConnectionNode!]!
    }

    # Organization connection related definitions

    enum OrganizationSortBy {
        name
    }

    input OrganizationSortInput {
        field: [OrganizationSortBy!]!
        order: SortOrder!
    }

    input OrganizationFilter {
        # table columns
        id: UUIDFilter
        name: StringFilter
        phone: StringFilter
        shortCode: StringFilter
        status: StringFilter

        # joined columns
        ownerUserId: UUIDFilter
        userId: UUIDFilter

        AND: [OrganizationFilter!]
        OR: [OrganizationFilter!]
    }

    type OrganizationsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [OrganizationsConnectionEdge]
    }

    type OrganizationsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: OrganizationConnectionNode
    }

    type OrganizationContactInfo {
        address1: String
        address2: String
        phone: String
    }

    type UserSummaryNode {
        id: String
    }

    type OrganizationConnectionNode {
        id: ID!
        name: String
        contactInfo: OrganizationContactInfo
        shortCode: String
        status: Status

        # connections
        owners: [UserSummaryNode]
        branding: Branding

        usersConnection(
            count: PageSize
            cursor: String
            filter: UserFilter
            sort: UserSortInput
            direction: ConnectionDirection
        ): UsersConnectionResponse

        schoolsConnection(
            count: PageSize
            cursor: String
            filter: SchoolFilter
            sort: SchoolSortInput
            direction: ConnectionDirection
        ): SchoolsConnectionResponse
    }
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            OrganizationConnectionNode: {
                owners: async (
                    organization: OrganizationConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) =>
                    ctx.loaders.organizationsConnection.owners.instance.load(
                        organization.id
                    ),
                branding: async (
                    organization: OrganizationConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context
                ) =>
                    ctx.loaders.organization.branding.instance.load(
                        organization.id
                    ),
                usersConnection: async (
                    organization: OrganizationConnectionNode,
                    args: IChildPaginationArgs,
                    ctx: Context,
                    info: GraphQLResolveInfo
                ) => {
                    return ctx.loaders.usersConnectionChild.instance.load({
                        args,
                        includeTotalCount: shouldIncludeTotalCount(info, args),
                        parent: {
                            id: organization.id,
                            filterKey: 'organizationId',
                            pivot: '"OrganizationMembership"."organization_id"',
                        },
                    })
                },
                schoolsConnection: async (
                    organization: OrganizationConnectionNode,
                    args: IChildPaginationArgs,
                    ctx: Context,
                    info: GraphQLResolveInfo
                ) => {
                    return ctx.loaders.schoolsConnectionChild.instance.load({
                        args,
                        includeTotalCount: shouldIncludeTotalCount(info, args),
                        parent: {
                            id: organization.id,
                            filterKey: 'organizationId',
                            pivot: '"Organization"."organization_id"',
                        },
                    })
                },
            },
            Mutation: {
                addUsersToOrganizations: (_parent, args, ctx, _info) =>
                    addUsersToOrganizations(args, ctx),
                organization: (_parent, args, _context, _info) =>
                    model.setOrganization(args),
                uploadOrganizationsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadOrganizationsFromCSV(args, ctx, info),
                renameDuplicateOrganizations: (_parent, args, ctx, info) =>
                    model.renameDuplicateOrganizations(args, ctx, info),
                setBranding: (_parent, args, ctx, info) =>
                    model.setBranding(args, ctx, info),
                deleteBrandingImage: (_parent, args, ctx, info) =>
                    model.deleteBrandingImage(args, ctx, info),
                deleteBrandingColor: (_parent, args, ctx, info) =>
                    model.deleteBrandingColor(args, ctx, info),
            },
            Query: {
                organizations: (_parent, args, _context, _info) =>
                    model.getOrganizations(args),
                organization: (_parent, { organization_id }, _context, _info) =>
                    model.getOrganization(organization_id),
                organizationsConnection: (
                    _parent,
                    args,
                    ctx: Context,
                    info
                ) => {
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
                    return model.organizationsConnection(ctx, info, args)
                },
                organizationNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.organizationNode.node.instance.load(args)
                },
            },
            Organization: {
                branding: (org: Organization, args, ctx: Context, _info) => {
                    return ctx.loaders.organization.branding.instance.load(
                        org.organization_id
                    )
                },
            },
            OrganizationMembership: {
                organization: (
                    membership: OrganizationMembership,
                    args,
                    ctx: Context,
                    _info
                ) => {
                    return ctx.loaders.organization.organization.instance.load(
                        membership.organization_id
                    )
                },
                user: (
                    membership: OrganizationMembership,
                    args,
                    ctx: Context,
                    _info
                ) => {
                    return ctx.loaders.user.user.instance.load(
                        membership.user_id
                    )
                },
            },
        },
    }
}
