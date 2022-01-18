# Subject Top-level Mutations

Ticket: <https://calmisland.atlassian.net/browse/UD-1410>

## Existing mutations

### Top level

There are 3 existing top level mutations:

- Updating an existing subject
- Creating subjects via CSV uploading
- Renaming duplicate subjects

*Note*: there will be no changes made to creating subjects via CSV uploading and renaming duplicate subjects.

GraphQL definition:

```graphql
extend type Mutation {
    subject(id: ID!): Subject @isAdmin(entity: "subject")
    uploadSubjectsFromCSV(file: Upload!): File
        @isMIMEType(mimetype: "text/csv")
    renameDuplicateSubjects: Boolean @isAdmin
}
```

### Beyond top level

There are 2 existing beyond top level mutations:

- Delete a subject
- Create or update subjects inside `Organization` type

GraphQL definition:

```graphql
type Subject {
    # Mutations
    delete(_: Int): Boolean
}

type Organization {
    # Mutations
    createOrUpdateSubjects(subjects: [SubjectDetail]!): [Subject]
}
```

Existing base types definition:

```graphql
input SubjectDetail {
    id: ID
    name: String
    categories: [ID!]
    system: Boolean
}
```

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Create subjects
  - Don't allow create `system` subjects so that `System` is omitted in input
  - `Status` is omitted as well because it doesn't make sense to create `INACTIVE` subjects
- Update subjects
  - We can use this mutation for replacing categories to subjects
  - Don't allow update `organization_id`
  - Don't allow update `system`
- Delete subjects

They're **all or nothing** mutations, it will succeed when all subjects are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
    createSubjects(input: [CreateSubjectInput!]!): SubjectsMutationOutput
    updateSubjects(input: [UpdateSubjectInput!]!): SubjectsMutationOutput
    deleteSubjects(input: [DeleteSubjectInput!]!): SubjectsMutationOutput
}

input CreateSubjectInput {
    name: String!
    organizationId: ID!
    categories: [ID!]
}

input UpdateSubjectInput {
    id: ID!
    name: String
    categories: [ID!]
}

input DeleteSubjectInput {
    id: ID!
}

type SubjectsMutationOutput {
    subjects: [SubjectConnectionNode!]!
}

# Existing definitions, put here for reference only

type SubjectConnectionNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!
    categories: [CategoryConnectionNode!]
    programs: [CoreProgramConnectionNode!]
}
```

The maximum length of `input.subjects` is `50`, same with our pagination limit. If the limit is violated, the endpoint will immediately raise an `APIError` that its code is `ERR_OPERATION_INPUT_MAX_LENGTH`.

## Deprecate mutations

We'll deprecate all beyond top level mutations below so that downstream services will use new mutations. The procedure to follow is documented in [Deprecating API's](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s).

```graphql
type Subject {
    # Mutations
    delete(_: Int): Boolean
}

type Organization {
    # Mutations
    createOrUpdateSubjects(subjects: [SubjectDetail]!): [Subject]
}
```
