# Age Range Top-level Mutations

Ticket: <https://calmisland.atlassian.net/browse/UD-1409>

## Existing mutations

### Top level

There are 2 existing top level mutations:

- Updating an existing age range
- Creating age ranges via CSV uploading

*Note*: there will be no changes made to creating age ranges via CSV uploading.

GraphQL definition:

```graphql
extend type Mutation {
    age_range(id: ID!): AgeRange @isAdmin(entity: "ageRange")
    uploadAgeRangesFromCSV(file: Upload!): File
        @isMIMEType(mimetype: "text/csv")
}
```

### Beyond top level

There are 2 existing beyond top level mutations:

- Delete an age range
- Create or update age ranges inside `Organization` type

GraphQL definition:

```graphql
type AgeRange {
    # Mutations
    delete(_: Int): Boolean
}

type Organization {
    # Mutations
    createOrUpdateAgeRanges(age_ranges: [AgeRangeDetail]!): [AgeRange]
}
```

Existing base types definition:

```graphql
input AgeRangeDetail {
    id: ID
    name: String
    low_value: Int
    high_value: Int
    low_value_unit: AgeRangeUnit
    high_value_unit: AgeRangeUnit
    system: Boolean
}

enum AgeRangeUnit {
    month
    year
}
```

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Create age ranges
  - Don't allow create `system` age ranges so that `System` is omitted in input
  - `Status` is omitted as well because it doesn't make sense to create `INACTIVE` age ranges
- Update age ranges
  - Don't allow update `organization_id`
  - Don't allow update `system`
- Delete age ranges

They're **all or nothing** mutations, it will succeed when all age ranges are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
    createAgeRanges(input: [CreateAgeRangeInput!]!): AgeRangesMutationOutput
    updateAgeRanges(input: [UpdateAgeRangeInput!]!): AgeRangesMutationOutput
    deleteAgeRanges(input: [DeleteAgeRangeInput!]!): AgeRangesMutationOutput
}

input CreateAgeRangeInput {
    name: String!
    organizationId: ID!
    lowValue: Int!
    highValue: Int!
    lowValueUnit: AgeRangeUnit!
    highValueUnit: AgeRangeUnit!
}

input UpdateAgeRangeInput {
    id: ID!
    name: String
    ageRanges: [ID!]
    grades: [ID!]
    subjects: [ID!]
}

input DeleteAgeRangeInput {
    id: ID!
}

type AgeRangesMutationOutput {
    ageRanges: [AgeRangeConnectionNode!]!
}

# Existing definitions, put here for reference only

type AgeRangeConnectionNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!
    lowValue: Int!
    lowValueUnit: AgeRangeUnit!
    highValue: Int!
    highValueUnit: AgeRangeUnit!
}
```

The maximum length of `input.ageRanges` is `50`, same with our pagination limit.  If the limit is violated, the endpoint will immediately raise an `APIError` that its code is `ERR_OPERATION_INPUT_MAX_LENGTH`.

## Deprecate mutations

We'll deprecate all beyond top level mutations below so that downstream services will use new mutations. The procedure to follow is documented in [Deprecating API's](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s).

```graphql
type AgeRange {
    # Mutations
    delete(_: Int): Boolean
}

type Organization {
    # Mutations
    createOrUpdateAgeRanges(age_ranges: [AgeRangeDetail]!): [AgeRange]
}
```
