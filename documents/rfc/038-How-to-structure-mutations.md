# RFC-038

## Synopsis

This RFC describes a basic template for designing mutations in the user-service graphQL schema that should meet the majority of our use cases and can be implemented efficiently.

## Background

There's problems with some of the existing mutations in our schema.

* The graphQL spec says you should not have mutations beyond the top level
  * [" Because the resolution of fields other than top‐level mutation fields must always be side effect‐free and idempotent, the execution order must not affect the result"](https://spec.graphql.org/June2018/#sec-Normal-and-Serial-Execution)
    * [Stackoverflow post with some more explanation](https://stackoverflow.com/a/54463837)
  * which means our mutations will be executed in parallel and could lead to unexpected results depending on the order they run in
* Some only let you update one entity at a time
  * And we do not/should not combine mutations before querying the DB (see above)
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

* Some are very open, allowing very complex operations to be constructed

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

Guidelines for our mutations:

* Optimize mutation design for known Use Cases
  * Don't add extra mutations just in case
  * We can build new ones as they are needed
* Must exist at the top level of the schema
  * So mutations are run in sequence
  * Because otherwise the spec and Apollo's implementation do not guarantee order of execution
* Should accept arrays if a Use Case would otherwise require calling the mutation multiple times
  * because mutations will be run in sequence, calling a mutation 10 times will take 10 times as long
    * Example:

    ```ts
      # good
      mutation {
        addThings(input: {ids: [ID!]})
      }
      # bad
      mutation {
        addThing(input:{id: ID})
        addThing(input:{id: ID})
      }
    ```

    * Allows us to (possibly) optimize the mutations from N queries to 1
  * Must enforce maximum lengths on these arrays - depending on use case
    * Without an explicit upper bound, there will still be an implicit one limited by performance
* May return a connection field for the mutated objects
* Should be as specific as possible
  * Helps us define stricter input and output types
  * The exception is if a Use Case would commonly require > 1 mutations and a single mutation would allow use to reduce the number of DB queries needed
    * See the single `updateClasses` mutation below, as opposed to `updateClassStatuses`, `updateClassNames`, etc
* On avoiding breaking changes/making it easy to deprecate fields:
  * Should use unique input/output types per mutation
  * Should put returned mutations in a field of the returned object
    * Easier to include metadata in responses if we ever want to
  * Should take an object as input
  * Should prefer nesting fields
  * Prefer `updateXs(input: {xs: [X]}): {xs: [X]}` to `updateXs(input: [X]): [X]`

For an entity `X` consider:

* `createXs`, `updateXs`, `deleteXs` if many Xs need to be changed at once
* `createX`, `updateX`, `deleteX` if single Xs need to be changed
* `updateXs` with replacement behavior for any properties of `X` it accepts
  * allow array properties of `X` to be empty so that the client can remove all elements easily
* If `X` has a relationship with `Y` and it is common to add many `X`'s to `Y` or many `Y`'s to `X`'s:
  * `addYstoXs(input: {mapping: [{x_id: ID, y_ids:[ID!]}]!}): {xs: [X]}`
* and the same for removing them:
  * `removeYsFromXs(input: {mapping: [{x_id: ID, y_ids:[ID!]}]!}): {xs: [X]}`
* Have all of these return the affected `X`'s: `createXs(input: {...}): {xs: [X]}`

### Examples

#### Class

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

* create one class at a time
* update and delete many classes at a time
* add many teachers to a class, or a teacher to many classes
* add many students to a class but not a student to many classes

New Schema:

```ts
extend type Mutation {
  # only need to make one class at a time
  createClass(input: {
    class_name: string
    organizationId: ID
    shortcode: string
    teachers: [ID!]
    students: [ID!]
  }): {classes: [Class]}
  # multiple deletes and updates at once
  deleteClasses(input: {
    ids: [ID!]
  }): {classes: [Class]}
  updateClasses(input: {
    classes: [{
      id: ID
      class_name: string
      shortcode: string
      teachers: [ID!]
      students: [ID!]
    }!]
  }): {classes: [Class]}
  # add many teachers to many classes
  addTeachersToClasses(input: {
    mapping: [{
      id: ID, teachers: [ID!]
    }!]
  }): {classes: [Class]}
  removeTeachersFromClasses(input: {
    mapping: [{
      id: ID, teachers: [ID!]
    }!]
  }): {classes: [Class]}
  # add many students but to only one class at a time
  addStudentsToClass(input: {
    classId: ID
    students:[ID!]
  }): {class: Class}
  removeStudentsFromClass(input: {
    classId: ID
    teachers:[ID!]
  }): {class: Class}
  # would be better with Objects for input/output
  # but not really worth the breaking change on its own
  uploadClassesFromCSV(file: Upload!): File
    @isMIMEType(mimetype: "text/csv")
}

type Class {
  class_id: ID!
  # other fields...
}

# replacements for editTeachers
extends Mutation {
  updateTeachers(input: {
    teachers: [{
      id: ID,
      # teacher properties...
    }!]
  }): {teachers: [Teacher]}
}
```

### Example: sharing programs

This shows what the mutations from this [RFC](https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2332000613/RFC-023a+-+GraphQL+interface+scoped+to+CMS+requirements?focusedCommentId=2332229878#comment-2332229878) should look like instead of those proposed

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
* Should be able to update more then one program per mutation
* split `createOrUpdateProgram` into more specific create and update mutations

New Schema:

```ts
extend type Mutation {
  createPrograms(input: {
    programs: [{
        name: String
        organizationId: ID
        system: Boolean
        ageRanges: [ID!]
        grades: [ID!]
        subjects: [ID!]
        status: Status
        sharedWith: [ID] # new
    }]
  }): {programs: [Program]}

  updatePrograms(input: {
    programs: [{
        id: ID
        name: String
        system: Boolean
        ageRanges: [ID!]
        grades: [ID!]
        subjects: [ID!]
        status: Status
        sharedWith: [ID] # new
    ]
  }): {programs: [Program]}

  deletePrograms(input: {
    programs: [ID!]
  }): {programs: [Program]}

  shareProgramsWithOrganziations(input: {
    mapping: [
        {programId: ID, organizationIds: [ID!]}
    ]
  }): {programs: [Programs]}

  unshareProgramsWithOrganziations(input: {
    mapping: [
        {programId: ID, organizationIds: [ID!]}
    ]
  }): {programs: [Program]}
}
```

### Out of scope

* How the SQL used in the mutations should be optimized
  * the patterns here only make it possible to efficiently updated many entities in the db at once, they do not enforce this

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
