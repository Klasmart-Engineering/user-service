import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { IChildPaginationArgs } from '../utils/pagination/paginate'
import { GraphQLResolveInfo } from 'graphql'
import { RoleConnectionNode } from '../types/graphQL/role'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { IChildConnectionDataloaderKey } from '../loaders/childConnectionLoader'
import { Permission } from '../entities/permission'
import { mutate } from '../utils/resolvers/commonStructure'
import { CreateRoles, UpdateRoles, DeleteRoles } from '../resolvers/role'
import { SelectQueryBuilder } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'

const typeDefs = gql`
    extend type Query {
        role(role_id: ID!): Role
            @isAdmin(entity: "role")
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        roles: [Role]
            @isAdmin(entity: "role")
            @deprecated(
                reason: "Sunset Date: 09/08/2022 Details: https://calmisland.atlassian.net/l/c/Z7e0ZCzm"
            )
        rolesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: RoleFilter
            sort: RoleSortInput
        ): RolesConnectionResponse @isAdmin(entity: "role")
        roleNode(id: ID!): RoleConnectionNode @isAdmin(entity: "role")
    }

    extend type Mutation {
        role(role_id: ID!): Role
        roles: [Role]
            @deprecated(
                reason: "Sunset Date: 09/08/2022 Details: https://calmisland.atlassian.net/l/c/Z7e0ZCzm"
            )
        uploadRolesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
        replaceRole(
            old_role_id: ID!
            new_role_id: ID!
            organization_id: ID!
        ): Role
        createRoles(input: [CreateRoleInput!]!): RolesMutationResult
        updateRoles(input: [UpdateRoleInput!]!): RolesMutationResult
        deleteRoles(input: [DeleteRoleInput!]!): RolesMutationResult
    }

    type RoleConnectionNode {
        id: ID!
        name: String
        description: String!
        status: Status!
        system: Boolean!
        permissionsConnection(
            direction: ConnectionDirection!
            count: PageSize
            cursor: String
            sort: PermissionSortInput
            filter: PermissionFilter
        ): PermissionsConnectionResponse
    }

    type Role {
        role_id: ID!

        #properties
        role_name: String
        role_description: String!
        status: Status!
        system_role: Boolean!

        #connections
        organization: Organization
        memberships: [OrganizationMembership]
            @isAdmin(entity: "organizationMembership")
        permissions: [Permission]
            @deprecated(
                reason: "Sunset Date: 26/02/2022 Details: https://calmisland.atlassian.net/l/c/1nEk2YHE"
            )
        permission(permission_name: String!): Permission

        #mutations
        set(
            role_name: String
            role_description: String
            system_role: Boolean
        ): Role
            @deprecated(
                reason: "Sunset Date: 03/04/2022 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
        grant(permission_name: String!): Permission
            @deprecated(
                reason: "Sunset Date: 09/08/2022 Details: https://calmisland.atlassian.net/l/c/Z7e0ZCzm"
            )
        revoke(permission_name: String!): Boolean
            @deprecated(
                reason: "Sunset Date: 09/08/2022 Details: https://calmisland.atlassian.net/l/c/Z7e0ZCzm"
            )
        edit_permissions(permission_names: [String!]): [Permission]
            @deprecated(
                reason: "Sunset Date: 26/05/2022 Details: https://calmisland.atlassian.net/l/c/ctBTX0xC"
            )
        deny(permission_name: String!): Permission
            @isAdmin
            @deprecated(
                reason: "Sunset Date: 09/08/2022 Details: https://calmisland.atlassian.net/l/c/Z7e0ZCzm"
            )

        delete_role(_: Int): Boolean
            @deprecated(
                reason: "Sunset Date: 27/03/2022 Details: https://calmisland.atlassian.net/l/c/8d8mpL0Q"
            )
    }

    # pagination extension types start here
    type RolesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [RolesConnectionEdge]
    }

    type RolesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: RoleConnectionNode
    }

    # pagination extension types end here

    enum RoleSortBy {
        id
        name
    }

    input RoleSortInput {
        field: RoleSortBy!
        order: SortOrder!
    }

    input RoleFilter {
        # table columns
        name: StringFilter
        status: StringFilter
        system: BooleanFilter
        organizationId: UUIDFilter
        schoolId: UUIDFilter
        schoolUserId: UUIDFilter
        membershipOrganizationUserId: UUIDFilter
        membershipOrganizationId: UUIDFilter

        #joined columns
        AND: [RoleFilter]
        OR: [RoleFilter]
    }

    # mutation types
    input CreateRoleInput {
        organizationId: ID!
        roleName: String!
        roleDescription: String!
    }

    input UpdateRoleInput {
        id: ID!
        roleName: String
        roleDescription: String
        permissionIds: [ID!]
    }

    input DeleteRoleInput {
        id: ID!
    }

    type RolesMutationResult {
        roles: [RoleConnectionNode!]!
    }
`

export async function permissionsChildConnectionResolver(
    role: Pick<RoleConnectionNode, 'id'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
) {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    return loadPermissionsForRole(ctx, role.id, args, includeTotalCount)
}

export async function loadPermissionsForRole(
    context: Pick<Context, 'loaders'>,
    roleId: RoleConnectionNode['id'],
    args: IChildPaginationArgs = {},
    includeTotalCount = true
) {
    const key: IChildConnectionDataloaderKey<Permission> = {
        args,
        includeTotalCount,
        parent: {
            id: roleId,
            filterKey: 'roleId',
            pivot: '"Role"."role_id"',
        },
        primaryColumn: 'permission_name',
    }
    return context.loaders.permissionsConnectionChild.instance.load(key)
}

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            Role: {
                memberships: (parent: Role, args, ctx) => {
                    const scope = args.scope as SelectQueryBuilder<OrganizationMembership>
                    return scope
                        .innerJoin('OrganizationMembership.roles', 'Role')
                        .andWhere('Role.role_id = :role_id', {
                            role_id: parent.role_id,
                        })
                        .getMany()
                },
            },
            RoleConnectionNode: {
                permissionsConnection: permissionsChildConnectionResolver,
            },
            Mutation: {
                roles: (_parent, args) => model.getRoles(args),
                role: (_parent, args) => model.getRole(args),
                uploadRolesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadRolesFromCSV(args, ctx, info),
                replaceRole: (_parent, args, ctx, info) =>
                    model.replaceRole(args, ctx, info),
                createRoles: (_parent, args, ctx) =>
                    mutate(CreateRoles, args, ctx.permissions),
                updateRoles: (_parent, args, ctx) =>
                    mutate(UpdateRoles, args, ctx.permissions),
                deleteRoles: (_parent, args, ctx) =>
                    mutate(DeleteRoles, args, ctx.permissions),
            },
            Query: {
                roles: (_parent, args) => model.getRoles(args),
                role: (_parent, args) => model.getRole(args),
                rolesConnection: (_parent, args, ctx: Context, info) => {
                    return model.rolesConnection(ctx, info, args)
                },
                roleNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.roleNode.node.instance.load(args)
                },
            },
        },
    }
}
