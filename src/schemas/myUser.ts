import { GraphQLResolveInfo } from 'graphql'
import gql from 'graphql-tag'
import { SelectQueryBuilder } from 'typeorm'
import { Permission } from '../entities/permission'
import { Context } from '../main'
import { Model } from '../model'
import {
    CoreOrganizationConnectionNode,
    organizationsConnectionResolver,
} from '../pagination/organizationsConnection'
import { permissionsConnectionResolver } from '../pagination/permissionsConnection'
import { schoolsConnectionResolver } from '../pagination/schoolsConnection'
import { mapUserToUserConnectionNode } from '../pagination/usersConnection'
import { PermissionName } from '../permissions/permissionNames'
import { UserPermissions } from '../permissions/userPermissions'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { PermissionConnectionNode } from '../types/graphQL/permission'
import { ISchoolsConnectionNode } from '../types/graphQL/school'
import { GraphQLSchemaModule } from '../types/schemaModule'
import {
    getEmptyPaginatedResponse,
    IChildPaginationArgs,
    IPaginatedResponse,
} from '../utils/pagination/paginate'

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
        Returns a paginated response of the permissions the user has in a given organization.
        """
        permissionsInOrganization(
            organizationId: ID!
            direction: ConnectionDirection
            count: PageSize
            cursor: String
            sort: PermissionSortInput
            filter: PermissionFilter
        ): PermissionsConnectionResponse @isAdmin(entity: "permission")

        """
        Returns a paginated response of the permissions the user has in a given school.
        """
        permissionsInSchool(
            schoolId: ID!
            direction: ConnectionDirection
            count: PageSize
            cursor: String
            sort: PermissionSortInput
            filter: PermissionFilter
        ): PermissionsConnectionResponse @isAdmin(entity: "permission")

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
                                    { organization_ids: [organizationId] },
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
                                    { school_ids: [schoolId] },
                                    permissionName
                                ),
                            }
                        })
                    )
                },
                permissionsInOrganization: async (
                    _,
                    args: PermissionsInOrganizationArgs,
                    ctx: Context,
                    info
                ): Promise<IPaginatedResponse<PermissionConnectionNode>> => {
                    const permissions = await ctx.permissions.permissionsInOrganization(
                        args.organizationId
                    )
                    return paginatePermissions(
                        permissions,
                        args.scope,
                        args,
                        info,
                        ctx.permissions
                    )
                },
                permissionsInSchool: async (
                    _,
                    args: PermissionsInSchoolArgs,
                    ctx: Context,
                    info
                ): Promise<IPaginatedResponse<PermissionConnectionNode>> => {
                    const permissions = await ctx.permissions.permissionsInSchool(
                        args.schoolId
                    )
                    return paginatePermissions(
                        permissions,
                        args.scope,
                        args,
                        info,
                        ctx.permissions
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

export async function paginatePermissions(
    permissions: string[],
    scope: SelectQueryBuilder<Permission>,
    args: IChildPaginationArgs,
    info: GraphQLResolveInfo,
    userPermissions: UserPermissions
) {
    if (permissions.length === 0) {
        return getEmptyPaginatedResponse<PermissionConnectionNode>(0)
    }
    if (!args.filter) args.filter = {}
    if (!args.filter.AND) args.filter.AND = []
    args.filter.AND.push({
        name: {
            operator: 'in',
            value: permissions,
        },
    })
    const result = await permissionsConnectionResolver(info, userPermissions, {
        direction: args.direction || 'FORWARD',
        directionArgs: {
            count: args.count,
            cursor: args.cursor,
        },
        scope,
        filter: args.filter,
    })
    return result
}

interface PermissionsInOrganizationArgs extends IChildPaginationArgs {
    organizationId: string
    scope: SelectQueryBuilder<Permission>
}

interface PermissionsInSchoolArgs extends IChildPaginationArgs {
    schoolId: string
    scope: SelectQueryBuilder<Permission>
}
