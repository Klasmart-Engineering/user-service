import gql from 'graphql-tag'
import { Context } from '../main'
import { Model } from '../model'
import {
    CoreOrganizationConnectionNode,
    organizationsConnectionResolver,
} from '../pagination/organizationsConnection'
import { schoolsConnectionResolver } from '../pagination/schoolsConnection'
import { mapUserToUserConnectionNode } from '../pagination/usersConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { ISchoolsConnectionNode } from '../types/graphQL/school'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { getEmptyPaginatedResponse } from '../utils/pagination/paginate'

const typeDefs = gql`
    extend type Query {
        myUser: MyUser
    }

    type UserPermissionStatus {
        permissionId: String!
        allowed: Boolean!
    }

    type MyUser {
        node: UserConnectionNode
        profiles: [UserConnectionNode!]!

        hasPermissionsInOrganization(
            organizationId: ID!
            permissionIds: [String!]!
        ): [UserPermissionStatus!]!

        hasPermissionsInSchool(
            schoolId: ID!
            permissionIds: [String!]!
        ): [UserPermissionStatus!]!

        """
        'operator' default = 'AND'
        """
        organizationsWithPermissions(
            permissionIds: [String!]!
            operator: LogicalOperator
            direction: ConnectionDirection
            count: PageSize
            cursor: String
            sort: OrganizationSortInput
            filter: OrganizationFilter
        ): OrganizationsConnectionResponse @isAdmin(entity: "organization")

        """
        'operator' default = 'AND'
        """
        schoolsWithPermissions(
            permissionIds: [String!]!
            operator: LogicalOperator
            direction: ConnectionDirection
            count: PageSize
            cursor: String
            sort: SchoolSortInput
            filter: SchoolFilter
        ): SchoolsConnectionResponse @isAdmin(entity: "school")
    }
`

export default function getDefault(model: Model): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            MyUser: {
                node: async (_parent, _args, ctx: Context, _info) => {
                    const user = await model.getMyUser(ctx.token)
                    if (!user) {
                        throw new APIErrorCollection([
                            new APIError({
                                code: customErrors.nonexistent_entity.code,
                                message:
                                    customErrors.nonexistent_entity.message,
                                variables: ['id'],
                                entity: 'User',
                                entityName: ctx.permissions.getUserId(),
                            }),
                        ])
                    }
                    return mapUserToUserConnectionNode(user)
                },
                profiles: async (_parent, _args, ctx: Context, info) => {
                    const users = await model.myUsers(ctx.token)
                    return users.map(mapUserToUserConnectionNode)
                },
                hasPermissionsInOrganization: async (
                    _parent,
                    args,
                    ctx: Context,
                    _info
                ) => {
                    const organizationId = args.organizationId
                    const permissions = args.permissionIds as PermissionName[]
                    return Promise.all(
                        permissions.map(async (permissionName) => {
                            return {
                                permissionId: permissionName,
                                allowed: ctx.permissions.allowed(
                                    {
                                        organization_id: organizationId,
                                        user_id: ctx.permissions.getUserId(),
                                    },
                                    permissionName
                                ),
                            }
                        })
                    )
                },
                hasPermissionsInSchool: async (
                    _parent,
                    args,
                    ctx: Context,
                    _info
                ) => {
                    const schoolId = args.schoolId
                    const permissions = args.permissionIds as PermissionName[]
                    return Promise.all(
                        permissions.map(async (permissionName) => {
                            return {
                                permissionId: permissionName,
                                allowed: ctx.permissions.allowed(
                                    {
                                        school_ids: [schoolId],
                                        user_id: ctx.permissions.getUserId(),
                                    },
                                    permissionName
                                ),
                            }
                        })
                    )
                },
                organizationsWithPermissions: async (
                    _parent,
                    args,
                    ctx: Context,
                    info
                ) => {
                    // Use cached permissions
                    const orgIds = await ctx.permissions.orgMembershipsWithPermissions(
                        args.permissionIds,
                        args.operator
                    )
                    if (orgIds.length !== 0) {
                        return organizationsConnectionResolver(info, {
                            direction: args.direction || 'FORWARD',
                            directionArgs: {
                                count: args.count,
                                cursor: args.cursor,
                            },
                            scope: args.scope,
                            filter: {
                                ...args.filter,
                                id: {
                                    operator: 'in',
                                    value: orgIds,
                                },
                            },
                        })
                    } else {
                        return getEmptyPaginatedResponse<CoreOrganizationConnectionNode>(
                            0
                        )
                    }
                },
                schoolsWithPermissions: async (
                    _parent,
                    args,
                    ctx: Context,
                    info
                ) => {
                    // Use cached permissions
                    const schoolIds = await ctx.permissions.schoolMembershipsWithPermissions(
                        args.permissionIds,
                        args.operator
                    )
                    if (schoolIds.length !== 0) {
                        return schoolsConnectionResolver(info, {
                            direction: args.direction || 'FORWARD',
                            directionArgs: {
                                count: args.count,
                                cursor: args.cursor,
                            },
                            scope: args.scope,
                            filter: {
                                ...args.filter,
                                schoolId: {
                                    operator: 'in',
                                    value: schoolIds,
                                },
                            },
                        })
                    } else {
                        return getEmptyPaginatedResponse<ISchoolsConnectionNode>(
                            0
                        )
                    }
                },
            },
            Query: {
                myUser: (_, _args, ctx, _info) => {
                    // all properties of MyUser have dedicated resolvers, so just return an empty object
                    return {}
                },
            },
        },
    }
}
