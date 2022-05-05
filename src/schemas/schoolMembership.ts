import gql from 'graphql-tag'
import { GraphQLResolveInfo } from 'graphql'
import { Context } from '../main'
import { Model } from '../model'
import { IDataLoaders } from '../loaders/setup'
import { RoleConnectionNode } from '../types/graphQL/role'
import { SchoolMembershipConnectionNode } from '../types/graphQL/schoolMembership'
import { GraphQLSchemaModule } from '../types/schemaModule'
import {
    IChildPaginationArgs,
    IPaginatedResponse,
    shouldIncludeTotalCount,
} from '../utils/pagination/paginate'

const typeDefs = gql`
    type SchoolMembershipConnectionNode {
        userId: String!
        schoolId: String!
        status: Status!
        joinTimestamp: Date
        user: UserConnectionNode @isAdmin(entity: "user")
        school: SchoolConnectionNode @isAdmin(entity: "school")
        rolesConnection(
            count: PageSize
            cursor: String
            filter: RoleFilter
            sort: RoleSortInput
            direction: ConnectionDirection
        ): RolesConnectionResponse
    }

    type SchoolMembershipsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [SchoolMembershipsConnectionEdge]
    }

    type SchoolMembershipsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: SchoolMembershipConnectionNode
    }

    input SchoolMembershipFilter {
        # table columns
        userId: UUIDFilter
        schoolId: UUIDFilter
        status: StringFilter

        # joined columns
        roleId: UUIDFilter

        AND: [SchoolMembershipFilter]
        OR: [SchoolMembershipFilter]
    }

    input SchoolMembershipSortInput {
        field: SchoolMembershipSortBy!
        order: SortOrder!
    }

    enum SchoolMembershipSortBy {
        userId
        schoolId
    }
`

export async function rolesConnectionChildResolver(
    membership: Pick<SchoolMembershipConnectionNode, 'schoolId' | 'userId'>,
    args: IChildPaginationArgs,
    ctx: Pick<Context, 'loaders'>,
    info: Pick<GraphQLResolveInfo, 'fieldNodes'>
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    const includeTotalCount = shouldIncludeTotalCount(info, args)
    return rolesConnectionChild(
        membership.schoolId,
        membership.userId,
        args,
        ctx.loaders,
        includeTotalCount
    )
}

export async function rolesConnectionChild(
    schoolId: SchoolMembershipConnectionNode['schoolId'],
    userId: SchoolMembershipConnectionNode['userId'],
    args: IChildPaginationArgs,
    loaders: IDataLoaders,
    includeTotalCount: boolean
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    return loaders.membershipRolesConnectionChild.instance.load({
        args,
        includeTotalCount,
        parent: {
            compositeId: [schoolId, userId],
            filterKeys: ['schoolId', 'schoolUserId'],
            pivots: [
                '"SchoolMembership"."school_id"',
                '"SchoolMembership"."user_id"',
            ],
        },
        primaryColumn: 'role_id',
    })
}

export default function getDefault(model: Model): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            SchoolMembershipConnectionNode: {
                user: (
                    parent: SchoolMembershipConnectionNode,
                    args,
                    ctx: Context
                ) => {
                    return ctx.loaders.userNode.node.instance.load({
                        id: parent.userId,
                        scope: args.scope,
                    })
                },
                school: (
                    parent: SchoolMembershipConnectionNode,
                    args,
                    ctx: Context
                ) => {
                    return ctx.loaders.schoolNode.instance.load({
                        id: parent.schoolId,
                        scope: args.scope,
                    })
                },
                rolesConnection: rolesConnectionChildResolver,
            },
        },
    }
}
