# User

Ticket: [UD-1445](https://calmisland.atlassian.net/browse/UD-1445)

## Existing mutations

### Top level

GraphQL definitions (filtering out those which are deprecated or not relevant to the User schema):

```graphql
type Mutation {
  ...
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
  uploadUsersFromCSV(file: Upload!, isDryRun: Boolean): File
  ...
}

```

### Beyond top level

```graphql
type User {
  ...
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
  merge(other_id: String): User
  setPrimary(_: Int): Boolean
}

type Organization {
  inviteUser(
    email: String
    phone: String
    given_name: String!
    family_name: String!
    date_of_birth: String
    username: String
    gender: String!
    shortcode: String
    organization_role_ids: [ID!]!
    school_ids: [ID!]
    school_role_ids: [ID!]
    alternate_email: String
    alternate_phone: String
  ): MembershipUpdate
  editMembership(
    user_id: ID!
    given_name: String!
    family_name: String!
    email: String
    phone: String
    date_of_birth: String
    username: String
    gender: String!
    shortcode: String!
    organization_role_ids: [ID!]!
    school_ids: [ID!]
    school_role_ids: [ID!]
    alternate_email: String
    alternate_phone: String
  ): MembershipUpdate
}

type OrganizationMembership {
  addRole(role_id: ID!): Role
  addRoles(role_ids: [ID!]!): [Role]
  removeRole(role_id: ID!): OrganizationMembership
}

type SchoolMembership {
  addRole(role_id: ID!): Role
  addRoles(role_ids: [ID!]!): [Role]
  removeRole(role_id: ID!): SchoolMembership
}
```

## Deprecate mutations

### To be deprecated

- `me`, should be a query
- Organization.`inviteUser`, replaced by `createUser` and `addUsersToOrganizations` (see organization schema)
- `user`, replaced by `updateUsers`
- User.`set`, replaced by `updateUsers`
- User.`setPrimary`, replaced by `updateUsers`
- User.`merge`, replaced by `mergeUsers`
- OrganizationMembership.`addRole`, replaced by `addOrganizationRolesToUser`
- OrganizationMembership.`addRoles`, replaced by `addOrganizationRolesToUser`
- OrganizationMembership.`removeRole`, replaced by `removeOrganizationRolesFromUsers`
- SchoolMembership.`addRole`, replaced by `addSchoolRolesToUsers`
- SchoolMembership.`addRoles`, replaced by `addSchoolRolesToUsers`
- SchoolMembership.`removeRole`, replaced by `removeSchoolRolesFromUsers`
- Organization.`editMembership`, replaced by `addOrganizationRolesToUser`, `addSchoolRolesToUser`, etc...

### To be kept

- `uploadUsersFromCSV`

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Create users
- Update Users
- Add/remove organization roles to/from users
- Add/remove school roles to/from users
- Merge Users

They're **all or nothing** mutations, it will succeed when all programs are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
  """
  At least one of either phone or email must be passed to this mutation
  """
  createUsers(input: [CreateUserInput!]!) : UsersMutationResult
  updateUsers(input: [UpdateUserInput!]!) : UsersMutationResult
  addOrganizationRolesToUsers(input: [AddOrganizationRolesToUserInput!]!) : UsersMutationResult
  removeOrganizationRolesFromUsers(input: [RemoveOrganizationRolesFromUserInput!]!) : UsersMutationResult
  addSchoolRolesToUsers(input: [AddSchoolRolesToUserInput!]!) : UsersMutationResult
  removeSchoolRolesFromUsers(input: [RemoveSchoolRolesFromUserInput!]!) : UsersMutationResult
  mergeUsers(input: [MergeUserInput!]!): UsersMutationResult
}

input CreateUserInput {
  givenName: String!
  familyName: String!
  contactInfo: ContactInfoInput!
  dateOfBirth: String
  username: String
  gender: String!
  shortcode: String
  alternateEmail: String
  alternatePhone: String
}

input ContactInfoInput {
  email: String
  phone: String
}

input UpdateUserInput {
  id: ID!
  givenName: String
  familyName: String
  email: String
  phone: String
  username: String
  dateOfBirth: String
  gender: String
  avatar: String
  alternateEmail: String
  alternatePhone: String
  primaryUser: Boolean
}

input AddOrganizationRolesToUserInput {
  userId: ID!
  organizationId: ID!
  roleIds: [ID!]!
}

input RemoveOrganizationRolesFromUserInput {
  userId: ID!
  organizationId: ID!
  roleIds: [ID!]!
}

input AddSchoolRolesToUserInput {
  userId: ID!
  schooId: ID!
  roleIds: [ID!]!
}

input RemoveSchoolRolesFromUserInput {
  userId: ID!
  schooId: ID!
  roleIds: [ID!]!
}

input MergeUserInput {
    mergeToUserId: ID!
    mergeFromUserId: ID!
}

type UsersMutationResult {
  users: [UserConnectionNode!]!
}
```
