# Role

Ticket: [UD-1413](https://calmisland.atlassian.net/browse/UD-1413)

## Existing mutations

### Top level

GraphQL definitions (filtering out those which are deprecated or not relevant to the Role schema):

```graphql
type Mutation {
  role(role_id: ID!): Role
  roles: [Role]
  uploadRolesFromCSV(file: Upload!): File
  replaceRole(old_role_id: ID!, new_role_id: ID!, organization_id: ID!): Role
}
```

### Beyond top level

```graphql
type Organization {
  ...
  createRole(role_name: String!, role_description: String!): Role
  ...
}

type Role {
  ...
  set(role_name: String, role_description: String, system_role: Boolean): Role
  grant(permission_name: String!): Permission
  revoke(permission_name: String!): Boolean
  edit_permissions(permission_names: [String!]): [Permission]
  deny(permission_name: String!): Permission
  delete_role(_: Int): Boolean
}
```

## Deprecate mutations

### To be deprecated

- `role`, should be a query
- `roles`, should be a query
- Organization.`createRole`, replaced by `createRoles`
- Role.`set`, replaced by `updateRoles`
- Role.`grant`, replaced by `addPermissionsToRoles`
- Role.`revoke`, replaced by `removePermissionsFromRoles`
- Role.`edit_permissions`, replaced by `updateRoles`
- Role.`deny`, should not be made availabe through public API
- Role.`delete_role`, replaced by `deleteRoles`
- `replaceRole`, replaced by 'replaceRoles'

### To be kept

- `uploadRolesFromCSV`

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://github.com/KL-Engineering/user-service/tree/main/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Create new roles
- Update existing roles
  - role name
  - role description
  - is system role
  - permissions
- Delete existing roles
- Add/remove permissions to/from roles

They're **all or nothing** mutations, it will succeed when all programs are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
  createRoles(input: [CreateRoleInput!]!) : RolesMutationResult
  updateRoles(input: [UpdateRoleInput!]!) : RolesMutationResult
  deleteRoles(input: [DeleteRoleInput!]!) : RolesMutationResult
  addPermissionsToRoles(input: [AddPermissionsToRoleInput!]!) : RolesMutationResult
  removePermissionsFromsRoles(input: [RemovePermissionsFromRoleInput!]!) : RolesMutationResult
  replaceRole(input: [ReplaceRoleInput!]!) : RolesMutationResult
}

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

input AddPermissionsToRoleInput {
  roleId: ID!
  permissionIds: [ID!]!
}

input RemovePermissionsFromRoleInput {
  roleId: ID!
  permissionIds: [ID!]!
}

input ReplaceRoleInput {
  oldRoleId: ID!
  newRoleId: ID!
  organizationId: ID!
}

type RolesMutationResult {
  roles: [RoleConnectionNode!]!
}
```
