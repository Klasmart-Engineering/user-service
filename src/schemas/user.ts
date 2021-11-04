import { ApolloServerExpressConfig } from 'apollo-server-express'
import Dataloader from 'dataloader'
import { GraphQLResolveInfo } from 'graphql'
import gql from 'graphql-tag'
import { User } from '../entities/user'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { IDataLoaders } from '../loaders/setup'
import {
    orgsForUsers,
    rolesForUsers,
    schoolsForUsers,
} from '../loaders/usersConnection'
import { Context } from '../main'
import { Model } from '../model'
import { CoreUserConnectionNode } from '../pagination/usersConnection'
import { UserConnectionNode } from '../types/graphQL/user'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import {
    addOrganizationRolesToUsers,
    removeOrganizationRolesFromUsers,
} from '../resolvers/user'
import { createUsers } from '../resolvers/user'

const typeDefs = gql`
    extend type Mutation {
        addOrganizationRolesToUsers(
            input: [AddOrganizationRolesToUserInput!]!
        ): UsersMutationResult
        removeOrganizationRolesFromUsers(
            input: [RemoveOrganizationRolesFromUserInput!]!
        ): UsersMutationResult
        me: User
        user(
            user_id: ID!
            given_name: String
            family_name: String
            email: String
            phone: String
            avatar: String
            date_of_birth: String
            username: String
            alternate_email: String
            alternate_phone: String
            gender: String
        ): User
        newUser(
            given_name: String
            family_name: String
            email: String
            phone: String
            avatar: String
            date_of_birth: String
            username: String
            gender: String
        ): User @deprecated(reason: "Use the inviteUser() method")
        switch_user(user_id: ID!): User
            @deprecated(reason: "Moved to auth service")
        uploadUsersFromCSV(file: Upload!, isDryRun: Boolean): File
            @isMIMEType(mimetype: "text/csv")
        createUsers(input: [CreateUserInput!]!): UsersMutationResult
    }

    # Definitions related to mutations

    input AddOrganizationRolesToUserInput {
        userId: ID!
        organizationId: ID!
        roleIds: [ID!]!
    }

    input RemoveOrganizationRolesFromUserInput {
        userId: ID!
        organizationId: ID!
        roleIds: [ID!]!
    }

    type UsersMutationResult {
        users: [UserConnectionNode!]!
    }

    # pagination extension types start here
    type UsersConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [UsersConnectionEdge]
    }

    type UsersConnectionEdge implements iConnectionEdge {
        cursor: String
        node: UserConnectionNode
    }

    # Mutation inputs

    input CreateUserInput {
        givenName: String!
        familyName: String!
        contactInfo: ContactInfoInput!
        dateOfBirth: String
        username: String
        gender: String!
        shortcode: String
        alternateEmail: String
        alternatePhone: String
    }

    input ContactInfoInput {
        email: String
        phone: String
    }

    # Mutation outputs

    type UsersMutationResult {
        users: [UserConnectionNode!]!
    }

    # pagination extension types end here

    enum UserSortBy {
        givenName
        familyName
    }

    input UserSortInput {
        field: [UserSortBy!]!
        order: SortOrder!
    }

    input UserFilter {
        # table columns
        userId: UUIDFilter
        userStatus: StringFilter
        givenName: StringFilter
        familyName: StringFilter
        avatar: StringFilter
        email: StringFilter
        phone: StringFilter

        # joined columns
        organizationId: UUIDFilter
        roleId: UUIDFilter
        schoolId: UUIDExclusiveFilter
        organizationUserStatus: StringFilter
        classId: UUIDExclusiveFilter

        AND: [UserFilter!]
        OR: [UserFilter!]
    }

    type UserConnectionNode {
        id: ID!
        givenName: String
        familyName: String
        avatar: String
        contactInfo: ContactInfo!
        alternateContactInfo: ContactInfo
        organizations: [OrganizationSummaryNode!]
            @deprecated(
                reason: "Sunset Date: 31/01/22 Details: https://calmisland.atlassian.net/l/c/7Ry00nhw"
            )

        organizationMembershipsConnection(
            count: PageSize
            cursor: String
            filter: OrganizationMembershipFilter
            sort: OrganizationMembershipSortBy
            direction: ConnectionDirection
        ): OrganizationMembershipsConnectionResponse

        classesStudyingConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: ClassFilter
            sort: ClassSortInput
        ): ClassesConnectionResponse

        classesTeachingConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: ClassFilter
            sort: ClassSortInput
        ): ClassesConnectionResponse

        roles: [RoleSummaryNode!]
        schools: [SchoolSummaryNode!]
        status: Status!
        dateOfBirth: String
        gender: String

        schoolMembershipsConnection(
            count: PageSize
            cursor: String
            direction: ConnectionDirection
            filter: SchoolMembershipFilter
            sort: SchoolMembershipSortInput
        ): SchoolMembershipsConnectionResponse
    }

    type ContactInfo {
        email: String
        phone: String
    }

    type OrganizationSummaryNode {
        id: ID!
        name: String
        joinDate: Date
        userStatus: Status
        status: Status
        userShortCode: String
    }

    type RoleSummaryNode {
        id: ID!
        name: String
        organizationId: String
        schoolId: String
        status: Status
    }

    type SchoolSummaryNode {
        id: ID!
        name: String
        organizationId: String
        status: Status
        userStatus: Status
    }

    extend type Query {
        me: User
        user(user_id: ID!): User
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        userNode(id: ID!): UserConnectionNode @isAdmin(entity: "user")
        usersConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: UserFilter
            sort: UserSortInput
        ): UsersConnectionResponse @isAdmin(entity: "user")
        users: [User] @deprecated(reason: "Unused")
        my_users: [User!]
            @deprecated(
                reason: "Use 'usersConnection with a filter for matching 'email' or 'phone'"
            )
    }

    type User {
        user_id: ID!

        #properties
        user_name: String @deprecated(reason: "Use 'full_name'.")
        full_name: String
        given_name: String
        family_name: String
        email: String
        phone: String
        date_of_birth: String
        avatar: String
        username: String
        primary: Boolean
        alternate_email: String
        alternate_phone: String
        gender: String
        #connections
        """
        'my_organization' is the Organization that this user has created
        """
        my_organization: Organization
            @deprecated(reason: "Use 'organization_ownerships'.")
        organization_ownerships: [OrganizationOwnership]
        memberships: [OrganizationMembership]
        membership(organization_id: ID!): OrganizationMembership

        school_memberships: [SchoolMembership]
        school_membership(school_id: ID!): SchoolMembership

        classesTeaching: [Class]
        classesStudying: [Class]

        #query
        organizationsWithPermission(
            permission_name: String!
        ): [OrganizationMembership]
        schoolsWithPermission(permission_name: String!): [SchoolMembership]
        subjectsTeaching: [Subject] @isAdmin(entity: "subject")

        #mutations
        set(
            given_name: String
            family_name: String
            email: String
            phone: String
            username: String
            date_of_birth: String
            gender: String
            avatar: String
            alternate_email: String
            alternate_phone: String
        ): User
        createOrganization(
            organization_name: String
            email: String # Not being used in resolver.
            address1: String
            address2: String
            phone: String
            shortCode: String
        ): Organization
        merge(other_id: String): User
        addOrganization(organization_id: ID!): OrganizationMembership
            @deprecated(
                reason: "Sunset Date: 01/02/22 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2419261457/"
            )
        addSchool(school_id: ID!): SchoolMembership
        setPrimary(_: Int): Boolean @isAdmin(entity: "user")
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            UserConnectionNode: {
                organizations: async (
                    user: UserConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context,
                    info
                ) => {
                    return info.path.prev?.key === 'userNode'
                        ? ctx.loaders.userNode.organizations.load(user.id)
                        : ctx.loaders.usersConnection?.organizations?.load(
                              user.id
                          )
                },
                organizationMembershipsConnection: organizationMembershipsConnectionResolver,
                schools: async (
                    user: UserConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context,
                    info
                ) => {
                    return info.path.prev?.key === 'userNode'
                        ? ctx.loaders.userNode.schools.load(user.id)
                        : ctx.loaders.usersConnection?.schools?.load(user.id)
                },
                roles: async (
                    user: UserConnectionNode,
                    args: Record<string, unknown>,
                    ctx: Context,
                    info
                ) => {
                    return info.path.prev?.key === 'userNode'
                        ? ctx.loaders.userNode.roles.load(user.id)
                        : ctx.loaders.usersConnection?.roles?.load(user.id)
                },

                classesStudyingConnection: classesStudyingConnectionResolver,
                classesTeachingConnection: classesTeachingConnectionResolver,
                schoolMembershipsConnection: schoolMembershipsConnectionResolver,
            },
            Mutation: {
                me: (_parent, _args, ctx, _info) => model.getMyUser(ctx),
                user: (_parent, args, _context, _info) => model.setUser(args),
                switch_user: (_parent, args, ctx, info) => {
                    throw new Error('Deprecated')
                },
                newUser: (_parent, args, _context, _info) =>
                    model.newUser(args),
                uploadUsersFromCSV: (_parent, args, ctx, info) =>
                    model.uploadUsersFromCSV(args, ctx, info),
                addOrganizationRolesToUsers: (_parent, args, ctx, _info) =>
                    addOrganizationRolesToUsers(args, ctx),
                removeOrganizationRolesFromUsers: (_parent, args, ctx, _info) =>
                    removeOrganizationRolesFromUsers(args, ctx),

                createUsers: (_parent, args, ctx, _info) =>
                    createUsers(args, ctx),
            },
            Query: {
                me: (_, _args, ctx, _info) => model.getMyUser(ctx),
                usersConnection: (_parent, args, ctx: Context, info) => {
                    // Regenerate the loaders on every resolution, because the `args.filter`
                    // may be different
                    // In theory we could store `args.filter` and check for deep equality, but this is overcomplicating things
                    ctx.loaders.usersConnection = {
                        organizations: new Dataloader((keys) =>
                            orgsForUsers(keys, args.filter)
                        ),
                        schools: new Dataloader((keys) =>
                            schoolsForUsers(keys, args.filter)
                        ),
                        roles: new Dataloader((keys) =>
                            rolesForUsers(keys, args.filter)
                        ),
                    }
                    return model.usersConnection(ctx, info, args)
                },
                userNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.userNode.node.instance.load(args)
                },
                users: (_parent, _args, ctx, _info) => [],
                user: (_parent, { user_id }, ctx: Context, _info) => {
                    return ctx.loaders.user.user.instance.load(user_id)
                },
                my_users: (_parent, _args, ctx, info) =>
                    model.myUsers({}, ctx, info),
            },
            User: {
                memberships: (user: User, _args, ctx: Context, info) => {
                    return ctx.loaders.user.orgMemberships.instance.load(
                        user.user_id
                    )
                },
                school_memberships: (user: User, _args, ctx: Context, info) => {
                    return ctx.loaders.user.schoolMemberships.instance.load(
                        user.user_id
                    )
                },
            },
        },
    }
}

export async function classesStudyingConnectionResolver(
    user: UserConnectionNode,
    args: Record<string, unknown>,
    ctx: Context,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return classesStudyingConnection(user, args, ctx.loaders, includeTotalCount)
}

export async function classesStudyingConnection(
    user: Pick<UserConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.classesConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: user.id,
            filterKey: 'studentId',
            pivot: '"Student"."user_id"',
        },
    })
}

export async function classesTeachingConnectionResolver(
    user: UserConnectionNode,
    args: Record<string, unknown>,
    ctx: Context,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return classesTeachingConnection(user, args, ctx.loaders, includeTotalCount)
}

export async function classesTeachingConnection(
    user: Pick<UserConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
) {
    return loaders.classesConnectionChild.instance.load({
        args,
        includeTotalCount: includeTotalCount,
        parent: {
            id: user.id,
            filterKey: 'teacherId',
            pivot: '"Teacher"."user_id"',
        },
    })
}
export async function organizationMembershipsConnectionResolver(
    user: Pick<CoreUserConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadOrganizationMembershipsForUser(
        ctx,
        user.id,
        args,
        includeTotalCount
    )
}

export async function loadOrganizationMembershipsForUser(
    context: Pick<Context, 'loaders'>,
    userId: CoreUserConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = false
) {
    const key: IChildConnectionDataloaderKey = {
        args,
        includeTotalCount,
        parent: {
            id: userId,
            filterKey: 'userId',
            pivot: '"OrganizationMembership"."user_id"',
        },
    }
    return context.loaders.organizationMembershipsConnectionChild.instance.load(
        key
    )
}

export async function schoolMembershipsConnectionResolver(
    user: Pick<UserConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadSchoolMembershipsForUser(ctx, user.id, args, includeTotalCount)
}

export async function loadSchoolMembershipsForUser(
    context: Pick<Context, 'loaders'>,
    userId: UserConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey = {
        args,
        includeTotalCount,
        parent: {
            id: userId,
            filterKey: 'userId',
            pivot: '"SchoolMembership"."user_id"',
        },
    }

    return context.loaders.schoolMembershipsConnectionChild.instance.load(key)
}
