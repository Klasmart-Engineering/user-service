# RFC-045: MyUser Query

## Synopsis

This RFC introduces a new root level query, `MyUser`, for fetching common information about the current user:

- User Info (`me`)
- User Profiles (`my_users`)
- Permissions (multiple ways)

## Background

By creating a new type to group these queries, we can address three current issues:

1: Easily fetching information for the current user:

  - This is one of the most common queries to the user service
  - Many clients (auth, live) only use  these queries, so they should be easy to use and understand
  - We currently suggest connection queries, but they are overly complex for this common use case
    - This has already been flagged by FE

2: Querying permissions

  - This is a performance bottleneck that we know we need to address
  - This RFC shows how we can use the cached permissions from UserPermissions to do this more efficiently

3: Deprecating old types
  - By grouping these queries in a new type, we can deprecate the old types such as `User` and `OrganizationMembership`

## Proposal

```gql
# GraphQL definitions
type UserPermissionStatus {
    permissionId: String!
    allowed: Boolean!
}

type MyUser {
    # replaces me{}
    node: UserConnectionNode @isAdmin(entity: "user")
    # replaces my_users{}
    profiles: [UserConnectionNode!]! @isAdmin(entity: "user")

    # replaces User.organizationsWithPermission
    organizationsWithPermissions(
        permissionIds: [String!]!
        direction: ConnectionDirection
        count: PageSize
        cursor: String
        sort: OrganizationSortInput
        filter: OrganizationFilter
    ): OrganizationsConnectionResponse @isAdmin(entity: "organization")


    # replaces User.schoolsWithPermission
    schoolsWithPermissions(
        permissionIds: [String!]!
        direction: ConnectionDirection
        count: PageSize
        cursor: String
        sort: SchoolSortInput
        filter: SchoolFilter
    ): SchoolsConnectionResponse @isAdmin(entity: "school")

    # # replaces user.membership.roles.permissions{}
    # # returns _all_ user permissions in org
    permissionsInOrganization(
        organizationId: ID!
        direction: ConnectionDirection
        count: PageSize
        cursor: String
        sort: PermissionSortInput
        filter: PermissionFilter
    ): PermissionsConnectionResponse @isAdmin(entity: "permission")

    # # replaces user.school_membership.roles.permissions{}
    # # returns _all_ user permissions in school
    permissionsInSchool(
        schoolId: ID!
        direction: ConnectionDirection
        count: PageSize
        cursor: String
        sort: PermissionSortInput
        filter: PermissionFilter
    ): PermissionsConnectionResponse @isAdmin(entity: "permission")

    # replaces user.membership.checkAllowed{}
    # returns an array of booleans for each permission provided
    hasPermissionsInOrganization(
        organizationId: ID!
        permissionIds: [String!]!
    ): [UserPermissionStatus!]!

    # replaces user.school_membership.checkAllowed{}
    # returns an array of booleans for each permission provided
    hasPermissionsInSchool(
        organizationId: ID!
        permissionIds: [String!]!
    ): [UserPermissionStatus!]!
}

extend type Query {
    myUser: MyUser
}
```

```ts
// Resolvers
resolvers: {
      MyUser: {
        node: (_parent, args, ctx: Context, _info) => {
          return ctx.loaders.userNode.node.instance.load({
            scope: args.scope,
            id: ctx.permissions.getUserId() || '',
          })
        },
        profiles: async (_parent, _, ctx: Context, info) => {
          // Use same query, but map to connection node
          const users = await model.myUsers({}, ctx, info)
          return users.map(mapUserToUserConnectionNode)
        },
        organizationsWithPermissions: async (_, args, ctx: Context, info) => {
          // Use cached permissions
          const orgIds = await ctx.permissions.orgMembershipsWithPermissions(
            args.permissionIds
          )
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
        },
        schoolsWithPermissions: async (_, args, ctx: Context, info) => {
            // same same but different
        }),
        permissionsInOrganization: async (_, args, ctx: Context, info) => {
          // Use cached permissions
          const permissions = await ctx.permissions.getUserPermissionsInOrg(
            args.organizationId
          )
        // TODO make sure filter.AND exists...
          args.filter.AND.push({
            name: {
              operator: 'in',
              value: permissions,
            },
          })
          return permissionsConnectionResolver(info, ctx, {
            direction: args.direction || 'FORWARD',
            directionArgs: {
              count: args.count,
              cursor: args.cursor,
            },
            scope: args.scope,
            filter: args.filter,
          })
        },
        permissionsInOrganization: async (_, args, ctx: Context, info) => {
            // same same but different
        },
        hasPermissionsInOrganization: async (_parent, args, ctx: Context, _info) => {
          const organization_id = args.organizationId
          const permissions = args.permissionIds as PermissionName[]
          return Promise.all(
            permissions.map(async (p) => {
              return {
                permissionId: p,
                allowed: ctx.permissions.allowed(
                  { organization_id, user_id: ctx.permissions.getUserId() },
                  p
                ),
              }
            })
          )
        },
        hasPermissionsInSchool: async (_parent, args, ctx: Context, _info) => {
            // same same but different
        }
      },
    },
}

```

## Query Example

#### Request
```gql
query {
  myUser {
    checkAllowed(
      organizationId: "2f0b9a4a-24ac-4cf4-8b69-64477ed57298"
      permissionIds: [
        "academic_profile_20100"
        "add_content_learning_outcomes_433"
      ]
    ) {
      permissionId
      allowed
    }

    permissionsInOrganization(
      organizationId: "2f0b9a4a-24ac-4cf4-8b69-64477ed57298",
      filter: {name: {operator: contains, value: "school"}}
      count: 2
    ) {
      totalCount
      edges {
        node {
          name
          group
        }
      }
    }

    organizationsWithPermissions(
      permissionIds: ["view_all_schools_pending_228"]
    ) {
      totalCount
      edges {
        node {
          name
          id
          usersConnection {
            totalCount
          }
        }
      }
    }
  }
}

```


#### Response

```json
{
  "data": {
    "myUser": {
      "checkAllowed": [
        {
          "permissionId": "academic_profile_20100",
          "allowed": true
        },
        {
          "permissionId": "add_content_learning_outcomes_433",
          "allowed": true
        }
      ],
      "permissionsInOrganization": {
        "totalCount": 19,
        "edges": [
          {
            "node": {
              "name": "create_all_schools_content_224",
              "group": "Create Content"
            }
          },
          {
            "node": {
              "name": "create_school_20220",
              "group": "Schools"
            }
          }
        ]
      },
      "organizationsWithPermissions": {
        "totalCount": 1,
        "edges": [
          {
            "node": {
              "name": "Williamson and Sons",
              "id": "2f0b9a4a-24ac-4cf4-8b69-64477ed57298",
              "usersConnection": {
                "totalCount": 45
              }
            }
          }
        ]
      }
    }
  }
}
```

## Out of scope

- Fetching profiles or permissions for *other* users. AFAIK this is not a common use case, please let me know if you know otherwise.
- Paginating user profiles
  - we don't expect this list to grow very large, and we don't need filtering support

## Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Approved  |   🟢   |
| Henrik           | Approved  |   🟢   |
| Matthew          | Approved  |   🟢   |
| Richard          | Approved  |   🟢   |
