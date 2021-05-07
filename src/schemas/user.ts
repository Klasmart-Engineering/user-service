import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { User } from '../entities/user'
import { orgsForUsers, schoolsForUsers } from '../dataloader'
import Dataloader from "dataloader";
import { Context } from '../main'


const typeDefs = gql`
    extend type Mutation {
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
        uploadUsersFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    # pagination extension types start here
    type UsersConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [UsersConnectionEdge]
    }

    type UsersConnectionEdge implements iConnectionEdge {
        cursor: String
        node: User
    }

    type UserConnection {
        total: Int
        edges: [User!]!
        pageInfo: PageInfo!
    }

    # pagination extension types end here

    input UserFilter {
        # table columns
        userId: StringFilter
        givenName: StringFilter
        familyName: StringFilter
        avatar: StringFilter
        email: StringFilter
        phone: StringFilter

        # joined columns
        organizationId: StringFilter

        AND: [UserFilter!]
        OR: [UserFilter!]
    }

    type UserConnectionNode {
        id: ID!
        givenName: String
        familyName: String
        avatar: String
        contactInfo: ContactInfo!
        organizations: [OrganizationSummaryNode!]!
        roles: [RoleSummaryNode!]!
        schools: [SchoolSummaryNode!]!
        status: Status!
    }

    type ContactInfo {
        email: String
        phone: String
    }

    type OrganizationSummaryNode {
        id: ID!
        name: String
        joinDate: String
        status: Status
    }

    type RoleSummaryNode {
        id: ID!
        name: String
        organizationId: String
        schoolId: String
    }

    type SchoolSummaryNode {
        id: ID!
        name: String
        organizationId: String
    }

    extend type Query {
        me: User
        user(user_id: ID!): User
        usersConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: UserFilter
        ): UsersConnectionResponse @isAdmin(entity: "user")
        users: [User]
        my_users: [User!]
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
        status: Status
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
        addSchool(school_id: ID!): SchoolMembership
        setPrimary(_: Int): Boolean @isAdmin(entity: "user")
    }
`

export default function getDefault(
    model: Model,
    context?: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            User: {
                memberships(user: User, args: any, ctx: Context) {
                    return ctx.loaders.memberships.load(user.user_id);
                },
                school_memberships(user: User, args: any, ctx: Context) {
                    return ctx.loaders.school_memberships.load(user.user_id);
                }
            },
            Mutation: {
                me: (_parent, _args, ctx, _info) => model.getMyUser(ctx),
                user: (_parent, args, _context, _info) => model.setUser(args),
                switch_user: (_parent, args, ctx, info) =>
                    model.switchUser(args, ctx, info),
                newUser: (_parent, args, _context, _info) =>
                    model.newUser(args),

                uploadUsersFromCSV: (_parent, args, ctx, info) =>
                    model.uploadUsersFromCSV(args, ctx, info),
            },
            Query: {
                me: (_, _args, ctx, _info) => model.getMyUser(ctx),
                usersConnection: (_parent, args, ctx: Context, _info) => {
                    ctx.loaders = {
                        memberships: new Dataloader(keys => orgsForUsers(keys, args.filter)),
                        school_memberships: new Dataloader(keys => schoolsForUsers(keys, args.filter)),
                    }
                    return model.usersConnection(ctx, args);
                },
                users: (_parent, _args, ctx, _info) => model.getUsers(),
                user: (_parent, { user_id }, _context, _info) =>
                    model.getUser(user_id),
                my_users: (_parent, _args, ctx, info) =>
                    model.myUsers({}, ctx, info),
            },
        },
    }
}
