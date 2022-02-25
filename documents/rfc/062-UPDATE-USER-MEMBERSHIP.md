# RFC-062-UPDATE_USER-MEMBERSHIP

## Synopsis

This RFC describes proposed API solution for the FE batch updating several user memberships in one organization with changes to Schools Classes Studying, Classes Teaching, and or Roles, along with the the status on the user membership. 

## Background

The FE have a requirement to be able to choose and assign groups of user memberships in one operation with particular changes to Schools, Classes Studying, Classes Teaching and Roles. They will edit a set of users on the screen and submit it all at once to the BE.

The purpose of this RFC is describe the API interface provided by the BE to implement this. Also to discuss how this could be done efficiently by the BE.

Issue https://calmisland.atlassian.net/browse/AD-2105

## Proposal

We propose that there will be a new GraphQl endpoint

```graphql
updateOrganizationUsers(
    input: 
    UpdateOrganizationUserInput!
    ): UsersMutationResult
```

The input data structure in this mutation is slightly different as we are applying changes to only one organization and an array of that organizations User/Memberships.

```graphql
input UpdateOrganizationUserInputElement{
    userId: ID!
    status: enum
    roles: [ ID! ]
    schools: [ ID! ]
    classes: [ ID! ]
}

input UpdateOrganizationUserInput{ 
    organizationId: ID!
    members: [ UpdateOrganizationUserInputElement ]   
}
```

The check will make sure all the users are in the organization, and all the passed classes and schools parameters are also in the organization. The roles parameter will check that these are either system roles or in the organization.

Changes in the parameters will replace all the relations passed that previously existed. Empty arrays in the parameters will make no changes.

We will either use the parameter array of roles or the existing roles if no roles are in the parameter to decide whether the classes parameter is classesTeaching or classesStudying or both. 

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
I intend to read the all parameter roles in the parameters and their linked permissions into memory as one operation to create a map to be used for each item in the array of members. The same will be done with the other parameters, so the number of database reads to check things can be as limited as possible.

### Error handling

If an error happens with any of the changes the whole change will be reverted.

An error value consisting of perhaps several APIError error reports will be returned that will contain the description and ids of the values that have the issue.

The back end will attempt to find as many errors as possible in any error situation so that the job of fixing the errors can be done in as few a iterations as possible

The index value returned in each APIError will refer to an index in the members array that is passed.

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
| Henrick          | Pending  |   🟡   |
| Ismael           | Pending  |   🟡   |


