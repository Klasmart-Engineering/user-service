# Grade Top-level Mutations

Ticket: https://calmisland.atlassian.net/browse/UD-1408

## Existing mutations

### Top level

There are 3 existing top level mutations:

- Updating an existing grade
- Creating grades via CSV uploading
- Indicating whether renaming duplicate grades is in effect

Note: there will be no changes made to creating grades via CSV uploading.

GraphQL definitions:

```graphql
extend type Mutation {
    grade(id: ID!): Grade @isAdmin(entity: "grade")
    uploadGradesFromCSV(file: Upload!): File
        @isMIMEType(mimetype: "text/csv")
    renameDuplicateGrades: Boolean @isAdmin
    }
```

### Beyond top level

There are 4 existing beyond top level mutations:

- Delete a grade
- Update grades inside `Class` type
- Update grades inside `Program` type
- Create or update grades inside `Organization` type

We will only redefine the "delete grade" mutation as root, since the other three belong to and act upon other entities. Those mutations should be covered in their PRs.

GraphQL definitions:

```graphql
type Grade {
    # Mutations
    delete(_: Int): Boolean
}
```

Base types definition:

```graphql
type GradeConnectionNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!
    fromGrade: GradeSummaryNode!
    toGrade: GradeSummaryNode!
}
```

## New mutations

Based on [RFC-038: How to structure mutations](https://github.com/KL-Engineering/user-service/tree/main/documents/rfc/038-How-to-structure-mutations.md), we want to define new top-level mutations. Below, we define the standard root mutations we want.

- Create grades
- Update grades (don't allow updating `organization_id`)
- Delete grades (adapted from existing beyond-top-level mutation)

They're **all or nothing** mutations, it will succeed when all grades are created successfully or will return errors even if one of them fails. This avoids:
- client-side mental overhead of having to keep track of what's been updated and what hasn't in our system
- server-side overhead of dealing with duplicate node scenarios if the client attempts to mutate multiple times

### Operations

- `createGrades`
- `updateGrades`
- `deleteGrades`

### GraphQL definitions

For `CreateGradeInput`, `status` field has been omitted as it may not make sense to create an `INACTIVE` grade, and it's not strictly required according to the existing `Grade` type schema.

For `CreateGradeInput`, `progressFromGradeId` and `progressToGradeId` are made mandatory, but not so in `UpdateGradeInput`. The presumption is that those fields are needed to create a grade, but it is presumed they already exist if one is just updating grades.

```graphql
input CreateGradeInput {
    name: String!
    organizationId: ID!
    progressFromGradeId: ID!
    progressToGradeId: ID!
}

input UpdateGradeInput {
    id: ID!
    name: String
    progressFromGradeId: ID
    progressToGradeId: ID
}

input DeleteGradeInput {
    id: ID!
}

type GradesMutationResult {
    grades: [GradeConnectionNode!]!
}

extend type Mutation {
    createGrades(input: [CreateGradeInput!]!): GradesMutationResult

    updateGrades(input: [UpdateGradeInput!]!): GradesMutationResult

    deleteGrades(input: [DeleteGradeInput!]!): GradesMutationResult
}
```

### Input limits

The maximum length of `grades` within `CreateGradesInput` and `UpdateGradesInput` is `50`, same with our pagination limit.

## Deprecate mutations

We'll deprecate all non-top-level mutations below so that downstream services will use new mutations. The procedure to follow is documented in https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s. As stated above, grade-related mutations happening in other entities will be defined as root mutations in other entities (i.e. create or update functions).

```
type Grade {
    # Mutations
    delete(_: Int): Boolean
}
```
