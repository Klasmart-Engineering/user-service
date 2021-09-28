# RFC-030 - Organizations Pagination & Filtering

## Synopsis

This documents outlines the design of the new endpoint for listing organizations with support for pagination and filtering.

## Background

This document provides endpoint-specific details. Please view [the pagination & filtering RFC](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/1605042208) for an overview of the shared aspects of the system.

Please see the proposed interface for the new endpoint and comment with any issues or considerations about the inputs & outputs, or any requirement that this does not meet.

Jira ticket https://calmisland.atlassian.net/browse/UD-987

## Proposal

### Endpoint

`/organizationsConnection`

### Filtering Schema

```ts
input OrganizationFilter {
    # table columns
    id: UUIDFilter
    name: StringFilter
    phone: StringFilter
    shortCode: StringFilter
    status: StringFilter

    # joined columns
    ownerUserId: UUIDFilter

    AND: [OrganizationFilter!]
    OR: [OrganizationFilter!]
}
```

`ownerId` filter allows to get organizations that an user is a owner.

### Response Schema

The following schema represents the data structure for node returned in the paginated response

```ts
type OrganizationConnectionNode {
    id: ID!
    name: String
    contactInfo: OrganizationContactInfo
    shortCode: String
    status: Status

    // connections
    owners: [UserSummaryNode!] // in the future, an user can have more than one organization
    branding: Branding
}

type OrganizationContactInfo {
    address1: String
    address2: String
    phone: String
    email: String
}

type UserSummaryNode {
    userId: ID!
}
```

### Permissions

- Super admins (which are being defined at https://bitbucket.org/calmisland/kidsloop-user-service/src/4b530317d54c86214ce7bb913231f2f8b899a29d/src/permissions/userPermissions.ts#lines-16 - Connect to preview until we have a better way, e.g. introduce a new role/permission): all organizations that are matching with the filters in the database are returned
- Other users: only organizations that the user belongs to and match with the filters are returned

### Example Query

```
query {
  organizationsConnection(
    direction: FORWARD
    filter: {
      id: {
        operator: eq
        value: "fd5d47b9-717a-467a-a658-6f47013c1fcf"
      }
      OR: [
        { name: { operator: contains, value: "Organization" } }
        { shortCode: { operator: contains, value: "GRO" } }
      ]
    }
  ) {
    totalCount
    edges {
      node {
        id
        name
        status
        shortCode
      }
    }
  }
}
```

### Decision

|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| Richard          | Approved | 🟢    |
| Oliver           | Approved | 🟢    |
| Max              | Approved | 🟢    |
