import gql from 'graphql-tag'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { IDataLoaders } from '../loaders/setup'
import { Context } from '../main'
import { Model } from '../model'
import {
    AddUsersToOrganizations,
    CreateOrganizations,
    RemoveUsersFromOrganizations,
} from '../resolvers/organization'
import { OrganizationConnectionNode } from '../types/graphQL/organization'
import { RoleConnectionNode } from '../types/graphQL/role'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    IChildPaginationArgs,
    IPaginatedResponse,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'
import { mutate } from '../utils/mutations/commonStructure'
import { Category } from '../entities/category'
import { Subcategory } from '../entities/subcategory'
import { AgeRange } from '../entities/ageRange'

const typeDefs = gql`
    scalar HexColor
    scalar Url

    extend type Mutation {
        """
        Creates a new organization, and makes the user its
        owner as well as a member of the organization.
        """
        createOrganizations(
            input: [CreateOrganizationInput!]!
        ): OrganizationsMutationResult
        addUsersToOrganizations(
            input: [AddUsersToOrganizationInput!]!
        ): OrganizationsMutationResult
        removeUsersFromOrganizations(
            input: [RemoveUsersFromOrganizationInput!]!
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
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        grades: [Grade!]
        categories: [Category!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
        subcategories: [Subcategory!]
            @deprecated(
                reason: "Sunset Date: 06/03/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2473459840"
            )
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
                reason: "Sunset Date: 01/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/UserService/pages/2462417870/"
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
            @deprecated(
                reason: "Sunset Date: 01/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2433581057"
            )
        createRole(role_name: String!, role_description: String!): Role
            @deprecated(
                reason: "Sunset Date: 29/03/2022 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
        createSchool(school_name: String, shortcode: String): School
        createClass(class_name: String, shortcode: String): Class
            @deprecated(
                reason: "Sunset Date: 10/04/2022 https://calmisland.atlassian.net/l/c/GSPr3XYb"
            )
        createOrUpdateAgeRanges(age_ranges: [AgeRangeDetail]!): [AgeRange]
        createOrUpdateGrades(grades: [GradeDetail]!): [Grade]
        createOrUpdateCategories(categories: [CategoryDetail]!): [Category]
            @deprecated(
                reason: "Sunset Date: 22/02/22 Details: https://calmisland.atlassian.net/l/c/kY3S0K0h"
            )
        createOrUpdateSubcategories(
            subcategories: [SubcategoryDetail]!
        ): [Subcategory]
            @deprecated(
                reason: "Sunset Date: 22/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2457174175"
            )
        createOrUpdateSubjects(subjects: [SubjectDetail]!): [Subject]
            @deprecated(
                reason: "Sunset Date: 11/04/2022 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
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
            @deprecated(
                reason: "Sunset Date: 01/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2433482757"
            )
        addRoles(role_ids: [ID!]!): [Role]
            @deprecated(
                reason: "Sunset Date: 01/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2433482757"
            )
        removeRole(role_id: ID!): OrganizationMembership
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2440790112"
            )
        leave(_: Int): Boolean
            @deprecated(
                reason: "Sunset Date: 13/03/22 Details: https://calmisland.atlassian.net/wiki/spaces/UserService/pages/2484240385/"
            )
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

    input CreateOrganizationInput {
        """
        A user who will become the organization's owner.
        Must not already own an organization.
        """
        userId: ID!
        organizationName: String!
        address1: String
        address2: String
        phone: String
        shortcode: String
    }

    input AddUsersToOrganizationInput {
        organizationId: ID!
        organizationRoleIds: [ID!]!
        userIds: [ID!]!
        shortcode: String
    }

    input RemoveUsersFromOrganizationInput {
        organizationId: ID!
        userIds: [ID!]!
    }

    type OrganizationsMutationResult {
        organizations: [OrganizationConnectionNode!]!
    }

    # Organization connection related definitions

    enum OrganizationSortBy {
        name
        ownerEmail
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
        ownerUserEmail: StringFilter
        ownerUsername: StringFilter
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
        email: String
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

        organizationMembershipsConnection(
            count: PageSize
            cursor: String
            filter: OrganizationMembershipFilter
            sort: OrganizationMembershipSortBy
            direction: ConnectionDirection
        ): OrganizationMembershipsConnectionResponse

        schoolsConnection(
            count: PageSize
            cursor: String
            filter: SchoolFilter
            sort: SchoolSortInput
            direction: ConnectionDirection
        ): SchoolsConnectionResponse

        rolesConnection(
            count: PageSize
            cursor: String
            filter: RoleFilter
            sort: RoleSortInput
            direction: ConnectionDirection
        ): RolesConnectionResponse

        classesConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: ClassFilter
            sort: ClassSortInput
        ): ClassesConnectionResponse

        categoriesConnection(
            count: PageSize
            cursor: String
            filter: CategoryFilter
            sort: CategorySortInput
            direction: ConnectionDirection
        ): CategoriesConnectionResponse

        subcategoriesConnection(
            count: PageSize
            cursor: String
            filter: SubcategoryFilter
            sort: SubcategorySortInput
            direction: ConnectionDirection
        ): SubcategoriesConnectionResponse

        ageRangesConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection!
            filter: AgeRangeFilter
            sort: AgeRangeSortInput
        ): AgeRangesConnectionResponse
    }
`

export async function schoolsChildConnectionResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return schoolsChildConnection(
        organization,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

//This method is split up from totalCount to be easily testable
export async function schoolsChildConnection(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.schoolsConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: organization.id,
            filterKey: 'organizationId',
            pivot: '"Organization"."organization_id"',
        },
        primaryColumn: 'school_id',
    })
}
export async function rolesConnectionChildResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = shouldIncludeTotalCount(info, args)
    return rolesConnectionChild(
        organization.id,
        args,
        ctx.loaders,
        includeTotalCount
    )
}
export async function rolesConnectionChild(
    organizationId: OrganizationConnectionNode['id'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    return loaders.rolesConnectionChild.instance.load({
        args,
        includeTotalCount,
        parent: {
            id: organizationId,
            filterKey: 'organizationId',
            pivot: '"Role"."organizationOrganizationId"',
        },
        primaryColumn: 'role_id',
        systemColumn: 'system_role',
    })
}

// This is a workaround to needing to mock total count AST check in tests
export async function classesChildConnectionResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return classesChildConnection(
        organization.id,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

export function classesChildConnection(
    organizationId: OrganizationConnectionNode['id'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.classesConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: organizationId,
            filterKey: 'organizationId',
            pivot: '"Class"."organizationOrganizationId"',
        },
        primaryColumn: 'class_id',
    })
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
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
                organizationMembershipsConnection: organizationMembershipsConnectionResolver,
                schoolsConnection: schoolsChildConnectionResolver,
                rolesConnection: rolesConnectionChildResolver,
                classesConnection: classesChildConnectionResolver,
                categoriesConnection: categoriesConnectionResolver,
                subcategoriesConnection: subcategoriesConnectionResolver,
                ageRangesConnection: ageRangesChildConnectionResolver,
            },
            Mutation: {
                createOrganizations: (_parent, args, ctx, _info) =>
                    mutate(CreateOrganizations, args, ctx.permissions),
                addUsersToOrganizations: (_parent, args, ctx, _info) =>
                    mutate(AddUsersToOrganizations, args, ctx.permissions),
                removeUsersFromOrganizations: (_parent, args, ctx, _info) =>
                    mutate(RemoveUsersFromOrganizations, args, ctx.permissions),
                organization: (_parent, args, _context, _info) =>
                    model.setOrganization(args),
                uploadOrganizationsFromCSV: (_parent, args, ctx, info) =>
                    Model.uploadOrganizationsFromCSV(args, ctx),
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

export function organizationMembershipsConnectionResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadOrganizationMembershipsForOrganization(
        ctx,
        organization.id,
        args,
        includeTotalCount
    )
}

export function loadOrganizationMembershipsForOrganization(
    context: Pick<Context, 'loaders'>,
    organizationId: OrganizationConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<OrganizationMembership> = {
        args,
        includeTotalCount,
        parent: {
            id: organizationId,
            filterKey: 'organizationId',
            pivot: '"OrganizationMembership"."organization_id"',
        },
        primaryColumn: 'user_id',
    }
    return context.loaders.organizationMembershipsConnectionChild.instance.load(
        key
    )
}

export async function categoriesConnectionResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadCategoriesForOrganization(
        ctx,
        organization.id,
        args,
        includeTotalCount
    )
}

export async function loadCategoriesForOrganization(
    context: Pick<Context, 'loaders'>,
    organizationId: OrganizationConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Category> = {
        args,
        includeTotalCount,
        parent: {
            id: organizationId,
            filterKey: 'organizationId',
            pivot: '"Organization"."organization_id"',
        },
        primaryColumn: 'id',
        systemColumn: 'system',
    }
    return context.loaders.categoriesConnectionChild.instance.load(key)
}

export async function ageRangesChildConnectionResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadAgeRangesForOrganization(
        ctx,
        organization.id,
        args,
        includeTotalCount
    )
}

export async function loadAgeRangesForOrganization(
    context: Pick<Context, 'loaders'>,
    organizationId: OrganizationConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<AgeRange> = {
        args,
        includeTotalCount,
        parent: {
            id: organizationId,
            filterKey: 'organizationId',
            pivot: '"Organization"."organization_id"',
        },
        primaryColumn: 'id',
        systemColumn: 'system',
    }
    return context.loaders.ageRangesConnectionChild.instance.load(key)
}

export async function subcategoriesConnectionResolver(
    organization: Pick<OrganizationConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSubcategoriesForOrganization(
        ctx,
        organization.id,
        args,
        includeTotalCount
    )
}

export async function loadSubcategoriesForOrganization(
    context: Pick<Context, 'loaders'>,
    organizationId: OrganizationConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Subcategory> = {
        args,
        includeTotalCount,
        parent: {
            id: organizationId,
            filterKey: 'organizationId',
            pivot: '"Organization"."organization_id"',
        },
        primaryColumn: 'id',
        systemColumn: 'system',
    }
    return context.loaders.subcategoriesConnectionChild.instance.load(key)
}
