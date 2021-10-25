# Organisation

Ticket: [UD-1404](https://calmisland.atlassian.net/browse/UD-1404)

## Existing mutations

### Top level

GraphQL definitions:

```graphql
extend type Mutation {
  organization(
      organization_id: ID!
      organization_name: String
      address1: String
      address2: String
      phone: String
      shortCode: String
  ): Organization
  uploadOrganizationsFromCSV(file: Upload!): File
      @isMIMEType(mimetype: "text/csv")
  renameDuplicateOrganizations: Boolean @isAdmin
  setBranding(
      organizationId: ID!
      iconImage: Upload
      primaryColor: HexColor
  ): Branding
  deleteBrandingImage(
      organizationId: ID!
      type: BrandingImageTag!
  ): Boolean
  deleteBrandingColor(organizationId: ID!): Boolean
}
```

### Beyond top level

```graphql
type Organization {
  # Properties
  ...
  # Mutation
  set(
      organization_name: String
      address1: String
      address2: String
      phone: String
      shortCode: String
  ): Organization
  setPrimaryContact(user_id: ID!): User
  addUser(user_id: ID!, shortcode: String): OrganizationMembership
  delete(_: Int): Boolean
}

type User {
  createOrganization(
    organization_name: String
    email: String
    address1: String
    address2: String
    phone: String
    shortCode: String
  ): Organization
  addOrganization(organization_id: ID!): OrganizationMembership
}

type OrganizationMembership {
  leave(_: Int): Boolean
}
```

## Deprecate mutations

### To be deprecated

- `organization`, replaced by `updateOrganizations`
- `setBranding`, replaced by `updateOrganizations`
- Organization.`set`, replaced by `updateOrganizations`
- Organization.`setPrimaryContact`, replaced by `updateOrganizations`
- Organization.`delete`, replaced by `deleteOrganisations`
- User.`createOrganization`, replaced by `createOrganizations`
- Organization.`addUser`, replaced by `addUsersToOrganizations`
- User.`addOrganization`, replaced by `addUsersToOrganizations`
- OrganizationMembership.`leave`, replaced by `removeUsersFromOrganizations`

### To be kept

- `uploadClassesFromCSV`
- `renameDuplicateOrganizations`
- `deleteBrandingImage`
- `deleteBrandingColor`

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Update the organizations' details
  - Organisation name
  - Address 1
  - Address 2
  - Phone
  - Shortcode
  - Primary Contact (User)
  - Branding
- Delete organisations
- Create organisations
- Add/remove users to/from organisations

They're **all or nothing** mutations, it will succeed when all programs are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
  createOrganizations(input: [CreateOrganizationInput!]!) : OrganizationsMutationResult
  updateOrganizations(input: [UpdateOrganizationInput!]!) : OrganizationsMutationResult
  deleteOrganizations(input: [DeleteOrganizationInput!]!) : OrganizationsMutationResult
  addUsersToOrganizations(input: [AddUsersToOrganizationInput!]!) : OrganizationsMutationResult
  removeUsersFromOrganizations(input: [RemoveUsersFromOrganizationInput!]!) : OrganizationsMutationResult
}

input CreateOrganizationInput {
  userId: ID!
  organizationName: String!
  email: String
  address1: String
  address2: String
  phone: String
  shortcode: String
  branding: Branding
}

input UpdateOrganizationInput {
  id: ID! 
  organizationName: String
  address1: String
  address2: String
  phone: String
  shortcode: String
  primaryContactId: ID
  branding: Branding
}

input DeleteOrganizationInput {
  id: ID!
}

input AddUsersToOrganizationInput {
  organizationId: ID!
  organizationRoleIds: [ID!]!
  userIds: [ID!]!
}

input RemoveUsersFromOrganizationInput {
  organizationId: ID!
  userIds: [ID!]!
}

type OrganizationsMutationResult {
  organizations: [OrganizationConnectionNode!]!
}
```
