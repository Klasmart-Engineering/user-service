# Class

Ticket: [UD-1406](https://calmisland.atlassian.net/browse/UD-1406)

## Existing mutations

### Top level

GraphQL definitions:

```graphql
extend type Mutation {
  classes: [Class]
  class(class_id: ID!): Class
  uploadClassesFromCSV(file: Upload!): File
   @isMIMEType(mimetype: "text/csv")
}
```

### Beyond top level

GraphQL definitions:

```graphql
type Class {
  # Properties
  ...
  # Mutations
  set(class_name: String, shortcode: String): Class
  addTeacher(user_id: ID!): User
  editTeachers(teacher_ids: [ID!]): [User]
  removeTeacher(user_id: ID!): Boolean
  addStudent(user_id: ID!): User
  editStudents(student_ids: [ID!]): [User]
  removeStudent(user_id: ID!): Boolean
  editSchools(school_ids: [ID!]): [School]
  editPrograms(program_ids: [ID!]): [Program]
  editAgeRanges(age_range_ids: [ID!]): [AgeRange]
  editGrades(grade_ids: [ID!]): [Grade]
  editSubjects(subject_ids: [ID!]): [Subject]
  delete(_: Int): Boolean
}

type Organisation {
  createClass(class_name: String, shortcode: String): Class
}
```

Base type definition:

```graphql
type Class {
  # Properties
  class_id: ID!
  class_name: String
  status: Status
  shortcode: String
  organization: Organization
  schools: [School]
  teachers: [User]
  students: [User]
  programs: [Program!]
  age_ranges: [AgeRange!]
  grades: [Grade!]
  subjects: [Subject!]
  # Mutations
  ...
}
```

## New mutations

Base on agreed [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top levels mutations.

- Create classes with name & shortcode
- Delete classes
- Update classes
  - Rename
  - Change shortcode
  - provide list of schools
  - provide list of programs
  - provide list of age ranges
  - provide list of grades
  - provide list of subjects
- Add/remove teachers
- Add/remove students
- Add/remove programs
- Add/remove age ranges
- Add/remove grades
- Add/remove subjects

Classes in school: should be part of school schema, not class

They're **all or nothing** mutations, it will succeed when all programs are created successfully or will return errors even if one of them fails.

GraphQL definitions:

```graphql
extend type Mutation {
  createClasses(input: [CreateClassInput!]!) : ClassesMutationResult
  updateClasses(input: [UpdateClassInput!]!): ClassesMutationResult
  deleteClasses(input: [DeleteClassInput!]!) : ClassesMutationResult
  addProgramsToClasses(input: [AddProgramsToClassInput!]!) : ClassesMutationResult
  removeProgramsFromClasses(input: [RemoveProgramsFromClassInput!]!) : ClassesMutationResult
  addAgeRangesToClasses(input: [AddAgeRangesToClassInput!]!) : ClassesMutationResult
  removeAgeRangesFromClasses(input: [RemoveAgeRangesFromClassInput!]!) : ClassesMutationResult
  addGradesToClasses(input: [AddGradesToClassInput!]!) : ClassesMutationResult
  removeGradesFromClasses(input: [RemoveGradesFromClassInput!]!) : ClassesMutationResult
  addSubjectsToClasses(input: [AddSubjectsToClassInput!]!) : ClassesMutationResult
  removeSubjectsFromClasses(input: [RemoveSubjectsFromClassInput!]!) : ClassesMutationResult
  addTeachersToClasses(input: [AddTeachersToClassInput!]!) : ClassesMutationResult
  removeTeachersFromClasses(input: [RemoveTeachersFromClassInput!]!) : ClassesMutationResult
  addStudentsToClasses(input: [AddStudentsToClassInput!]!) : ClassesMutationResult
  removeStudentsFromClasses(input: [RemoveStudentsFromClassInput!]!) : ClassesMutationResult
}

input CreateClassInput {
  organizationId: ID!
  className: String!
  shortcode: String
}

input UpdateClassInput {
  classId: ID!
  className: String
  shortcode: String
  schoolIds: [ID!]
  programsIds: [ID!]
  ageRangeIds: [ID!]
  gradeIds: [ID!]
  subjectIds: [ID!]
}

input DeleteClassInput {
  id: ID!
}

input AddProgramsToClassInput {
  classId: ID!
  programsIds: [ID!]!
}

input RemoveProgramsFromClassInput {
  classId: ID!
  programsIds: [ID!]!
}

input AddAgeRangesToClassInput {
  classId: ID!
  ageRangeIds: [ID!]!
}

input RemoveAgeRangesFromClassInput {
  classId: ID!
  ageRangeIds: [ID!]!
}

input AddGradesToClassInput {
  classId: ID!
  gradeIds: [ID!]!
}

input RemoveGradesFromClassInput {
  classId: ID!
  gradeIds: [ID!]!
}

input AddSubjectsToClassInput {
  classId: ID!
  subjectIds: [ID!]!
}

input RemoveSubjectsFromClassInput {
  classId: ID!
  subjectIds: [ID!]!
}

input AddTeachersToClassInput {
  classId: ID!
  teacherId: [ID!]!
}

input RemoveTeachersFromClassInput {
  classId: ID!
  teacherId: [ID!]!
}

input AddStudentsToClassInput {
  classId: ID!
  studentId: [ID!]!
}

input RemoveStudentsFromClassInput {
  classId: ID!
  studentId: [ID!]!
}

type ClassesMutationResult {
  classes: [ClassConnectionNode!]!
}
```

## Deprecate mutations

We'll deprecate all mutations described in 'Existing Mutations' except for `uploadClassesFromCSV`.
