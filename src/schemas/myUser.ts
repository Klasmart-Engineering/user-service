import gql from 'graphql-tag'
import { Context } from '../main'
import { Model } from '../model'
import { mapUserToUserConnectionNode } from '../pagination/usersConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { GraphQLSchemaModule } from '../types/schemaModule'

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
