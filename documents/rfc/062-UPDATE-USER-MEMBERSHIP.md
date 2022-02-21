# RFC-062-UPDATE_USER-MEMBERSHIP

## Synopsis

This RFC describes proposed API solution for the FE batch updating several user memberships in one organization with the same additions to Schools Classes Studying, Classes Teaching, and or Roles, along with the same status on the user membership. 

## Background

The FE have a requirement to be able to choose and assign the groups or user memberships in one operation with particular additions to Schools, Classes Studying, Classes Teaching and Roles.

The purpose of this RFC is describe the API interface provided by the BE to implement this.

Issue https://calmisland.atlassian.net/browse/AD-2105

## Proposal

We propose that there will be a new GraphQl endpoint

```graphql
updateOrganizationUsers(
    input: 
    UpdateOrganizationUserInput!
    ): UsersMutationResult
```

The input data structure in this mutation is quite different from that of other batch mutations as in this case we are applying the same changes across the set of User/Memberships.

```graphql
input UpdateOrganizationUserInput{ 
   input:{
     organizationId: ID!
     status: enum
     users:[ ID! ]!
     roles: [ ID! ]
     schools: [ ID! ]
     classesTeaching: [ ID! ]
     classesStudying: [ ID! ]
    }
}
```

Changes will be additive and if the user in the organization already has role X and we assign role X no error will be returned.

The reason for a UsersMutationResult return type is that classesTeaching, classesStudying and Schools are relations on the User entity not the OrganizationMembership entity.

For completeness here is the definition of a UsersMutationResult

```graphql
type UsersMutationResult {
  users: [UserConnectionNode!]!
}
```

And a UserConnectionNode

```graphql
type UserConnectionNode {
  id: ID!
  givenName: String
  familyName: String
  avatar: String
  contactInfo: ContactInfo
  alternateContactInfo: ContactInfo
  status: Status!
  dateOfBirth: String
  username: String
  gender: String
  organizationMembershipsConnection(
    count: PageSize
    cursor: String
    filter: OrganizationMembershipFilter
    sort: OrganizationMembershipSortBy
    direction: ConnectionDirection
  ): OrganizationMembershipsConnectionResponse
  schoolMembershipsConnection(
    count: PageSize
    cursor: String
    direction: ConnectionDirection
    filter: SchoolMembershipFilter
    sort: SchoolMembershipSortInput
  ): SchoolMembershipsConnectionResponse
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
}
```
The Roles will be visible from the OrganizationMembershipConnectionResponse object

```graphql
type OrganizationMembershipsConnectionResponse implements iConnectionResponse {
  totalCount: Int
  pageInfo: ConnectionPageInfo
  edges: [OrganizationMembershipsConnectionEdge]
}

type OrganizationMembershipsConnectionEdge implements iConnectionEdge {
  cursor: String
  node: OrganizationMembershipsConnectionNode
}

type OrganizationMembershipConnectionNode {
  userId: String!
  organizationId: String!
  status: Status!
  shortCode: String
  joinTimestamp: String
  user: UserConnectionNode
  organization: OrganizationConnectionNode
  rolesConnection(
    count: PageSize
    cursor: String
    filter: RoleFilter
    sort: RoleSortInput
    direction: ConnectionDirection
  ): RolesConnectionResponse
}

```


### Error handling

If an error happens with any of the changes the whole change will be reverted.

An error value consisting of perhaps several APIError error reports will be returned that will contain the description and ids of the values that have the issue.

The back end will attempt to find as many errors as possible in any error situation so that the job of fixing the errors can be done in as few a iterations as possible

The index value returned in each APIError will refer to an index in the users array that is passed.

## Decision


|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Toghrul          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
| Malcolm          | Pending  |   🟡   |
| Hendrick         | Pending  |   🟡   |
| Ismael           | Pending  |   🟡   |


