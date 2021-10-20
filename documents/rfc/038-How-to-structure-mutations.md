# RFC-038

## Synopsis

This RFC describes a basic template for designing mutations in the user-service graphQL schema that should meet the majority of our use cases and can be implemented efficiently.

## Background

There are problems with some of the existing mutations in our schema.

The graphQL spec says you should not have mutations beyond the top level. Otherwise, our mutations will be executed in parallel and could lead to unexpected results depending on the order they run in.
* [" Because the resolution of fields other than top‐level mutation fields must always be side effect‐free and idempotent, the execution order must not affect the result"](https://spec.graphql.org/June2018/#sec-Normal-and-Serial-Execution)
* [Stackoverflow post with some more explanation](https://stackoverflow.com/a/54463837)

Some only let you update one entity at a time, and we do not/should not combine mutations before querying the DB (see above).
* for example this will require 4 queries (a lookup for each `grade(id:...)` and for each child):

```ts
  mutation {
      grade(id: "blah"){
          delete
      }
      grade(id: "blah"){
          delete
      }
  }
```

Some are very open, allowing very complex operations to be constructed:

    ```ts
    mutation {
      organization(organization_id: "blah"){
        editMembership(user_id: "dd"){
          user{
            user_id
          }
        },
        createOrUpdateGrades(grades: [{id: "blah"}]){
          id
        }
      },
      school{
        school_id,
        organization{
          organization_id
          # possibly more mutations...
        }
      }
    }
    ```

This was also motivated by the attempt to define new mutations for [this RFC](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2332000613/RFC-023a+-+GraphQL+interface+scoped+to+CMS+requirements) and the lack of a guide for designing them.

## Proposal

The guidelines below are designed to:

1. Avoid undefined behavior/complying with the graphQL spec
2. Make it easy to minimize the number of DB queries made
3. Assist the deprecating/adding of fields to mutations

### High-level design guidelines

Optimize mutation design for known Use Cases.
* Don't add extra mutations just in case
* We can build new ones as they are needed

Must exist at the top level of the schema.
* Guarantees mutations are run in sequence
* Because otherwise the spec and Apollo's implementation do not guarantee order of execution

Should accept arrays if a Use Case would otherwise require calling the mutation multiple times. In other words, design the method to handle *one or more* entity updates. This allows us to (possibly) optimize the mutations from N queries to 1.
  * because mutations will be run in sequence, calling a mutation 10 times will take 10 times as long

  ```ts
    # good
    mutation {
      createThings(input: {ids: [ID!]})
    }
    # bad
    mutation {
      createThing(input:{id: ID})
      createThing(input:{id: ID})
    }
  ```

Must enforce maximum lengths on these arrays - depending on use case. 
* Without an explicit upper bound, there will still be an implicit one limited by performance.

### Allowed operations

There are five allowed operations:
* `Create` (`createXs`)
* `Update` (`updateXs`)
* `Delete` (`deleteXs`)
* `Add` (`addXsToYs`)
* `Remove` (`removeXsFromYs`)
### Input-Output guidelines

The main idea is to explicitly wrap inputs and outputs in types, which allows adding/deprecating fields and avoids breaking changes (e.g. backend first adds an optional input field, then frontend adds that field to mutation query after). Specific guidelines below:

Inputs and outputs should be focused on mutating one entity.
* Other entity fields may still be part of the mutation if they're needed for the operation. For example, `organizationId` is not part of `Grade` but is needed when `create`-ing a `Grade`
* Continuing the above, these considerations should happen when a Use Case would commonly require 2+ mutations - a single mutation would allow us to reduce the number of DB queries needed. See the single `updateClasses` mutation below, as opposed to `updateClassStatuses`, `updateClassNames`, etc.
* The `addXsToYs` and `removeXsFromYs` scenarios are focused on mutating the `Y` entity, therefore I/O type fields should be related to `Y` (although input fields would include necessary `X` fields as well)

Should use unique input/output types per mutation, i.e. explicitly defined types. Therefore, for an entity `X`, a mutation method signature should take the form `operationXs(input: [OperationXInput!]!): OperationXsOutput`.
* The same applies to mutations involving adding or removing `X`s from `Y`s: `operationXs[To/From]Ys(input: [OperationXsToYInput!]!): OperationXsToYsOutput`
* Input types should be defined with `input`, i.e. `input OperationEntityInput` rather than `type OperationEntityInput`. This is because `type` fields allow for interfaces or resolvers (in the programmatic sense) which are linked to other areas in the codebase, whereas `input` is designed as a standalone separate type which does not have such dependencies (as there shouldn't be during input)

Naming follows a strict and consistent format.
* I/O types use PascalCase; mutation methods use camelCase
* When naming input types, use singular form for entity, as each input represents one instance of that entity. Input type naming should follow the format `operation`+`Entity`+`"Input"` (e.g. `CreateGradeInput`). This extends to adding/removing "sub-entities" (plural) to an entity (singular) (e.g. teachers to/from a class) e.g. `AddTeachersToClassInput`
* When naming output types, use plural form for entity, as a single object is returned wrapping a list of that entity's objects. Output type naming should follow the format `operation`+`Entities`+`"Output"` (e.g. `UpdateProgramsOutput`)

Input type/object fields are specific to the Use Case.
* Include the minimum number of fields needed to perform an operation. A `delete` only needs an ID, whereas `create` and `update` need more input fields
* Consider domain aspects which differ by operation (e.g. `id` doesn't make sense as a `create` input field because an ID is automatically created for a new entity, whereas including `id` does make sense as an `update` input field so the server knows which entity node to update)
* Adding/removing operations's input types for adding/removing `X`s to/from `Y`s include fields of both `X`s IDs and the singular `Y` they are applied to

Output type/object fields are specific to the mutated entity and must consider result query limitation standards.
* Put returned mutations in a field of the returned type object, as a list. This way it's easier to include metadata in responses if we ever want to
* Return entity type is of form `${Entity}ConnectionNode` (at the time of RFC writing, these types may not exist yet). In general, these return entity types should exist, don't create new types
* Consolidate all output types into a single output type of the form: `type ${Entity}sMutationResult { entities: [EntityConnectionNode] }`. E.g. `type GradesMutationResult { grades: [GradeConnectionNode] }`. Any possible future additional fields can be made optional and feature-flagged to provide backwards compatibility and flexibility on which operations we desire additional output with. Consolidating into a single output type presents benefits in readability, reducing the number of output types to maintain, and follows the YAGNI principle
* For add/remove cases (e.g. `addXsToYs`), return  `[Y]` as per the guidelines above
* Clients may need to perform followup read-only queries on the mutation output. At the time of writing (Oct 18, 2021), `user-service` has agreed to temporarily limit query depth of output types to `1`. Therefore, ensure the mutation output adheres to this rule. Limiting return query depth to `1` mitigates risk of dataloaders behaving differently to what we expect in mutation responses. Root-level mutations are run sequentially (not parallel). For example, the mutation below runs `createPrograms` twice, in sequence, such that we can take advantage of dataloaders per `createPrograms` response but NOT across `createPrograms` responses. Therefore, *each* `ageRangesConnection` is one dataloaded query
```ts
mutation {
  createPrograms(input: [CreateProgramInput!]!) {
    programs {
        ageRangesConnection{
            id
        }
    }
  }
  createPrograms(input: [CreateProgramInput!]!) {
    programs {
        ageRangesConnection{
            id
        }
    }
  }
}
```


### Example: classes

Existing schema:

```ts
extend type Mutation {
  classes: [Class]
  class(class_id: ID!): Class
  uploadClassesFromCSV(file: Upload!): File
   @isMIMEType(mimetype: "text/csv")
}

type Class {
  class_id: ID!
  # other fields...
  # mutations
  set(
    class_name: String
    shortcode: String
  ): Class
  addTeacher(
    user_id: ID!
  ): User
  editTeachers(
    teacher_ids: [ID!]
  ): [User]
  removeTeacher(
    user_id: ID!
  ): Boolean
  addStudent(
    user_id: ID!
  ): User
  editStudents(
    student_ids: [ID!]
  ): [User]
  removeStudent(
    user_id: ID!
  ): Boolean
  delete(
    _: Int
  ): Boolean
  # other mutations...
}
```

Fictional use cases:

* update or delete one or more classes at a time
* add many teachers to a class, or a teacher to many classes
* add many students to a class but not a student to many classes

New Schema:

```ts
input UpdateClassInput {
  id: ID!
  class_name: String
  shortcode: String
  teachers: [ID!]
  students: [ID!]
}

input DeleteClassInput {
  id: ID!
}

input AddTeachersToClassInput {
  id: ID!
  teachers: [ID!]!
}

input RemoveTeachersFromClassInput {
  id: ID!
  teachers: [ID!]!
}

type ClassesMutationResult {
  classes: [ClassConnectionNode!]!
}

extend type Mutation {

  # multiple updates at once
  updateClasses(input: [UpdateClassInput!]!): ClassesMutationResult
  
  # multiple deletes at once
  deleteClasses(input: [DeleteClassInput!]!): ClassesMutationResult

  # add many teachers to one or more classes
  addTeachersToClasses(input: [AddTeachersToClassInput!]!): ClassesMutationResult

   # remove many teachers from one or more classes
  removeTeachersFromClasses(input: [RemoveTeachersFromClassInput!]!): ClassesMutationResult

  # would be better with Objects for input/output
  # but not really worth the breaking change on its own
  uploadClassesFromCSV(file: Upload!): File
    @isMIMEType(mimetype: "text/csv")
}
```

### Example: sharing programs

This shows what the mutations from this [RFC](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2332000613/RFC-023a+-+GraphQL+interface+scoped+to+CMS+requirements?focusedCommentId=2332229878#comment-2332229878) should look like instead of those proposed.

Originally proposed schema changes:

```ts
organization(
  organization_id: ID!
): Organization

type Organization {
  createOrUpdatePrograms(
    programs: [ProgramDetail]!
  ): [Program]
  #...
}

type ProgramDetail {
  id: ID
  name: String
  system: Boolean
  age_ranges: [ID!]
  grades: [ID!]
  subjects: [ID!]
  status: Status
  sharedWith: [ID] # new
}

type Program {
  id: ID!
  name: String!
  system: Boolean!
  status: Status
  age_ranges: [AgeRange!]
  grades: [Grade!]
  subjects: [Subject!]
  sharedWith: [ID] # new
  ...
  # Mutations
  share(organizationIds: [ID!]): [ID] # new
  unshare(organizationIds: [ID!]): [ID] # new
  ...
}
```

Presumed Use Cases:

* share many programs with many organizations
* create/update/delete many programs at once

Changes to make:

* `createOrUpdatePrograms`, `share` and `unshare` should be top-level
* Should be able to update more than one program per mutation
* split `createOrUpdateProgram` into more specific create and update mutations

New Schema:

```ts
input CreateProgramInput {
  name: String
  organizationId: ID
  system: Boolean
  ageRanges: [ID!]
  grades: [ID!]
  subjects: [ID!]
  status: Status
  sharedWith: [ID] # new
}

input UpdateProgramInput {
  id: ID
  name: String
  system: Boolean
  ageRanges: [ID!]
  grades: [ID!]
  subjects: [ID!]
  status: Status
  sharedWith: [ID] # new
}

input DeleteProgramInput {
  ids: ID!
}

# Types below do not fall under list of allowed operations but are natural extensions for this problem

input ShareProgramsWithOrganizationInput {
  programId: ID!
  organizationIds: [ID!]!
}

input UnshareProgramsWithOrganizationInput {
  programId: ID!
  organizationIds: [ID!]!
}

type ProgramsMutationResult {
  programs: [ProgramConnectionNode!]!
}

extend type Mutation {

  createPrograms(input: [CreateProgramInput!]!): ProgramsMutationResult

  updatePrograms(input: [UpdateProgramInput!]!): ProgramsMutationResult

  deletePrograms(input: [DeleteProgramInput!]!): ProgramsMutationResult

  shareProgramsWithOrganziations(input: [ShareProgramsWithOrganizationInput!]!): ProgramsMutationResult

  UnshareProgramsWithOrganziations(input: [UnshareProgramsWithOrganizationInput!]!): ProgramsMutationResult
}
```

### Further discussion topics

We may look to large organizations like GitHub for existing GraphQL mutation schema practices. The below compares GitHub's practices to this RFC.

What GitHub and this RFC agree on:
- Each mutation has an associated input type and output type
- I/O type naming convention is <mutation_name> + Input, written in PascalCase
- Attributes are in camelCase
- Input & output types are not wrapped in objects

What GitHub and this RFC do differently:
- I/O types are auto-generated
- Use of possibleTypes directives on input IDs
- Always return ID of client which performed operation
- Does not always return ID of deleted object

### Out of scope

How the SQL used in the mutations should be optimised.
* The patterns here only make it possible to efficiently update many entities in the DB at once, they do not enforce this

### Appendix

[Interesting blog post on how some GraphQL implementations do allow nested mutations](https://blog.logrocket.com/supporting-opt-in-nested-mutations-in-graphql/)
[Blogpost on which touches on 1) designing a graphQL API to generate events 2) optimistic concurrency control on mutation requests](https://techblog.commercetools.com/modeling-graphql-mutations-52d4369f73b1)
[Why specific mutations are useful](https://xuorig.medium.com/graphql-mutation-design-anemic-mutations-dd107ba70496)
[apollo advice on designing mutations](https://www.apollographql.com/blog/graphql/basics/designing-graphql-mutations/)

### Decision

|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| Enrique        | Pending |   🟡  |
| Matthew      | Pending |   🟡  |
| Max  | Pending |   🟡  |
| Richard  | Pending |   🟡 |
| Matt  | Pending  |   🟡  |
| Sam  | Pending  |   🟡  |
| Raphael  | Pending  |   🟡  |
| Marlon  | Pending  |   🟡  |
| Nicholas  | Pending  |   🟡  |
