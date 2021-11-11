# RFC-057

## Synopsis

The user-service exposes membership information - the roles a user has for a given school or organization.
This RFC discusses how to expose that using our new child connection approach from RFC-044.

## Background

Memberships are 3 way relationships between users, roles and schools or users, roles and organizations.
This allows a user to have different sets of roles (and therefore permissions) scoped to particular schools or organizations.

We currently expose memberships in a few ways.

```
# from the user
user("a UUID"){
    # organization memberships
    memberships: {
        user{
            ...
        }
        organization{
            ...
        },
        roles{
            ...
        }
    },
    school_memberships{
        user {
            ...
        }
        school {
            ...
        },
        roles {
            ...
        }
    }
}
# from a role
role("a UUID"){
    # org memberships
    memberships{
        user{
            ...
        }
        organization{
            ...
        },
        roles{
            ...
        }
    }
    # school memberships not directly exposed
}
# from an org
organization("a UUID"){
    # org memberships
    memberships{
        user{
            ...
        }
        organization{
            ...
        },
        roles{
            ...
        }
    },
    # filtered by organization ID and current user ID
    school_memberships{
        ...
    }
}
# from a school
school("a UUID"){
    school_memberships{
        user {
            ...
        }
        school {
            ...
        },
        roles {
            ...
        }
    }
}
```

We do not offer top-level fields for memberships themselves.

## Proposal

We will:

* not create top-level connection fields for memberships
  * these would be useful when a client needs to query for memberships regardless of their relations with other entities - that isn't a use case we need to support right now
* add membership connection fields to roles, users, schools and organizations
  * only support filtering by membership properties and role IDs
  * give a run time error if client tries to filter on the same entity ID as the parent
* add filter arguments for user/role/org/school IDs where they are missing from user/role/school/org connections
  * this helps work around the lack of direct user/role/org/school property filtering on the membership connection
  * for example, to get all users in an org with give name X, use the top-level `usersConnection` with `organizationId` and `givenName` filters
* implement school and organization membership connections as distinct fields

Although there are a lot of similarities between these membership kinds, their future business requirements are very fuzzy and its entirely possible school and organization memberships end up with divergent use cases. Implementing a new feature on both is easier then splitting out a combined implementation.

They're already slightly divergent as short code is only supported for organization membership.

There's also the possibility of class memberships being added in future - again the requirements for that are not clear yet. So we don't want to risk having to cram it into an ill fitting shared implementation.

## Memberships

### Connection

Organization memberships

```
type OrganizationMembershipsConnectionResponse implements iConnectionResponse {
    totalCount: Int
    pageInfo: ConnectionPageInfo
    edges: [OrganizationMembershipsConnectionEdge]
}

type OrganizationMembershipsConnectionEdge implements iConnectionEdge {
    cursor: String
    # this type is defined later
    node: OrganizationMembershipConnectionNode
}

input OrganizationMembershipFilter {
    # table columns
    shortCode: stringFilter
    organizationId: UUIDFilter
    userId: UUIDFilter

    # joined columns
    roleId: UUIDFilter

    AND: [OrganizationMembershipFilter]
    OR: [OrganizationMembershipFilter]
}

input OrganizationMembershipSortInput {
    field: OrganizationMembershipSortBy!
    order: SortOrder!
}

enum OrganizationMembershipSortBy {
    userId
    organizationId
}
```

School memberships

```
type SchoolMembershipsConnectionResponse implements iConnectionResponse {
    totalCount: Int
    pageInfo: ConnectionPageInfo
    edges: [SchoolMembershipsConnectionEdge]
}

type schoolMembershipsConnectionEdge implements iConnectionEdge {
    cursor: String
    # this type is defined later
    node: SchoolMembershipConnectionNode
}

input SchoolMembershipFilter {
    # table columns
    userId UUIDFilter
    schoolId: UUIDFilter

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
```

### Node

```
organizationMembershipNode(userId: ID!, organizationId: ID!): OrganizationMembershipConnectionNode
schoolMembershipNode(userId: ID!, schoolId: ID!): SchoolMembershipConnectionNode

type OrganizationMembershipConnectionNode {
    user: UserConnectionNode
    organization: OrganizationConnectionNode
    # implicitly filters on organization and user IDs
    rolesConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: RolesFilter
        sort: RolesSortInput
    ): RolesConnectionResponse
}

type SchoolMembershipConnectionNode {
    user: UserConnectionNode
    school: SchoolConnectionNode
    # implicitly filters on school and user IDs
    rolesConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: RolesFilter
        sort: RolesSortInput
    ): RolesConnectionResponse
}
```

## user

### Connection

Unchanged, can already filters on user, organization, role and school IDs

### Node

```
type UserConnectionNode {
    # snip...
    organizationMembershipsConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: OrganizationMembershipFilter
        sort: OrganizationMembershipSortInput
    ): OrganizationMembershipsConnectionResponse
    schoolMembershipsConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: SchoolMembershipFilter
        sort: SchoolMembershipSortInput
    ): SchoolMembershipsConnectionResponse
    # deprecate:
    # schoolMemberships(...){...}
    # memberships(...){...}
}
```

## Roles

### connection

```
input RoleFilter {
    # snip...
    # this already has an organization ID filter
    # but it filters on the organization that owns a role
    # rather then the memberships it's part of
    # which does not mean the same thing for system roles
    # which are not part of an organization
    membershipOrganizationId: UUIDFilter
    schoolId: UUIDFilter
    userID: UUIDFilter
}
```

### Node

```
type RoleConnectionNode {
    # snip...
    organizationMembershipsConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: OrganizationMembershipFilter
        sort: OrganizationMembershipSortInput
    ): OrganizationMembershipsConnectionResponse
    schoolMembershipsConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: SchoolMembershipFilter
        sort: SchoolMembershipSortInput
    ): SchoolMembershipsConnectionResponse
    # deprecate:
    # this connection becomes really complicated if it tries
    # to handle school and organization membership joins to user
    #usersConnection...
}
```

## Organization

### Connection

```
input OrganizationFilter {
    # already has an ID filter for organization and user
    roleId: UUIDFilter
}
```

### Node

There is going to be a rolesConnection on OrganizationConnectionNode's, (not part of this spec) but its for roles that are owned by the organization - nothing to do with memberships.

```
type OrganizationConnectionNode {
    # snip...
    organizationMembershipsConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: OrganizationMembershipFilter
        sort: OrganizationMembershipSortInput
    ): OrganizationMembershipsConnectionResponse
    # remove the unreleased usersConnection
    # usersConnection(
    #    count: PageSize
    #    cursor: String
    #    direction: ConnectionDirection
    #    filter: UserFilter
    #    sort: UserSortInput
    #): UsersConnectionResponse
```

## School

### Connection

```
input SchoolFilter {
    # can already filter on school id
    roleId: UUIDFilter
    userId: UUIDFilter
}
```

### Node

```
type SchoolConnectionNode {
    # snip...
    schoolMembershipsConnection(
        count: PageSize
        cursor: String
        direction: ConnectionDirection
        filter: SchoolMembershipFilter
        sort: SchoolMembershipSortInput
    ): SchoolsMembershipsConnectionResponse
    # remove unreleased child usersConnection
    # usersConnection(
    #     count: PageSize
    #     cursor: String
    #     direction: ConnectionDirection
    #     filter: UserFilter
    #     sort: UserSortInput
    # ): UsersConnectionResponse
}
```

## Out of scope

* There is a medium-long term vision to potentially remove roles from memberships relations, but this is not concrete enough to take into account yet.

## Appendix

None

## Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
