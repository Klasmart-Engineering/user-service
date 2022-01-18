# Program Top-level Mutations

Ticket: <https://calmisland.atlassian.net/browse/UD-1407>

## Existing mutations

### Top level

There are 2 existing top level mutations:

- Updating an existing program
- Creating programs via CSV uploading

*Note*: there will be no changes made to creating programs via CSV uploading.

GraphQL definitions:

```graphql
extend type Mutation {
    program(id: ID!): Program @isAdmin(entity: "program")
    uploadProgramsFromCSV(file: Upload!): File
        @isMIMEType(mimetype: "text/csv")
}
```

### Beyond top level

There are 5 existing beyond top level mutations:

- Delete a program
- Create or update programs for an `Organization`
- Edit grades of a `Program`
- Edit age ranges of a `Program`
- Edit subjects of a `Program`

GraphQL definitions:

```graphql
type Program {
    # Mutations
    delete(_: Int): Boolean
    editAgeRanges(age_range_ids: [ID!]): [AgeRange]
    editGrades(grade_ids: [ID!]): [Grade]
    editSubjects(subject_ids: [ID!]): [Subject]
}

type Organization {
    # Mutations
    createOrUpdatePrograms(programs: [ProgramDetail]!): [Program]
}
```

Existing base types definition:

```graphql
type AgeRange {
    id: ID!
    name: String!
    low_value: Int!
    high_value: Int!
    low_value_unit: AgeRangeUnit!
    high_value_unit: AgeRangeUnit!
    system: Boolean!
    status: Status
}

type Grade {
    id: ID!
    name: String!
    progress_from_grade: Grade
    progress_to_grade: Grade
    system: Boolean!
    status: Status
}

type Subject {
    id: ID!
    name: String!
    categories: [Category!]
    subcategories: [Subcategory!]
    system: Boolean!
    status: Status
}

type Program {
    id: ID!
    name: String!
    system: Boolean!
    status: Status
    age_ranges: [AgeRange!]
    grades: [Grade!]
    subjects: [Subject!]
}

input ProgramDetail {
    id: ID
    name: String
    system: Boolean
    age_ranges: [ID!]
    grades: [ID!]
    subjects: [ID!]
    status: Status
}
```

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Create programs
  - Don't allow create `system` programs so that `System` is omitted in input
  - `Status` is omitted as well because it doesn't make sense to create `INACTIVE` programs
- Update programs
  - We can use this mutation for replacing below entities to programs so that we don't need to have new mutations like `addXsToYs` or `removeXsFromYs`:
    - Grades
    - Age ranges
    - Subjects
  - Don't allow update `organization_id`
  - Don't allow update `system`
- Delete programs

They're **all or nothing** mutations, it will succeed when all programs are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
    createPrograms(input: [CreateProgramInput!]!): ProgramsMutationOutput
    updatePrograms(input: [UpdateProgramInput!]!): ProgramsMutationOutput
    deletePrograms(input: [DeleteProgramInput!]!): ProgramsMutationOutput
}

input CreateProgramInput {
    name: String!
    organizationId: ID!
    ageRanges: [ID!]
    grades: [ID!]
    subjects: [ID!]
}

input UpdateProgramInput {
    id: ID!
    name: String
    ageRanges: [ID!]
    grades: [ID!]
    subjects: [ID!]
}

input DeleteProgramInput {
    id: ID!
}

type ProgramsMutationOutput {
    programs: [ProgramConnectionNode!]!
}

# Existing definitions, put here for reference only

type ProgramConnectionNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!
    ageRanges: [AgeRangeConnectionNode!]
    grades: [GradeSummaryNode!]
    subjects: [CoreSubjectConnectionNode!]
}
```

The maximum length of `input.programs` is `50`, same with our pagination limit. If the limit is violated, the endpoint will immediately raise an `APIError` that its code is `ERR_OPERATION_INPUT_MAX_LENGTH`.

## Deprecate mutations

We'll deprecate all beyond top level mutations below so that downstream services will use new mutations. The procedure to follow is documented in [Deprecating API's](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s).

```graphql
type Program {
    # Mutations
    delete(_: Int): Boolean
    editAgeRanges(age_range_ids: [ID!]): [AgeRange]
    editGrades(grade_ids: [ID!]): [Grade]
    editSubjects(subject_ids: [ID!]): [Subject]
}

type Organization {
    # Mutations
    createOrUpdatePrograms(programs: [ProgramDetail]!): [Program]
}
```
