# Academic Term Creation

## Current mutations for school creation/edition

- `createSchools`
- `addProgramsToSchools`
- `removeProgramsFromSchools`

## Proposal

Add `createAcademicTerms` & `deleteAcademicTerms` mutations.

```gql
type AcademicTerm {
    id: ID!
    name: String!
    startDate: Date!
    endDate: Date!
    status: Status!
    school: SchoolConnectionNode!
}

input CreateAcademicTermInput {
    schoolId: ID!
    name: String!
    startDate: Date!
    endDate: Date!
}

input DeleteAcademicTermInput {
    id: ID!
}

type AcademicTermsMutationResult {
    academicTerms: [AcademicTermConnectionNode!]!
}

extend type Mutation {
    createAcademicTerms(input: [CreateAcademicTermInput!]!): AcademicTermsMutationResult
    deleteAcademicTerms(input: [DeleteAcademicTermInput!]!): AcademicTermsMutationResult
} 
```

## Implementation Details
- `createAcademicTerms` & `deleteAcademicTerms` should be atomic across inputs
- Appropriate validation should be performed:
    - `schoolId` exists
    - `startDate` < `endDate`
    - no overlapping start/end dates between inputs AND existing academic terms
    - user has appropriate permissions

## New mutations for school creation

- `createSchools`
- `addProgramsToSchools`
- `removeProgramsFromSchools`
- `createAcademicTerms`
- `deleteAcademicTerms`

## UI Flow & Atomicity
UI flow is split into the following steps:
- set school name & shortcode
- create academic terms
- add existing programs
- CONFIRM and create

Although it indicates that the steps are executed atomically, they are not; not in the currently-used deprecated mutations (`createSchools` and `school.editPrograms`), nor in the new mutations.

It is therefore up to the frontend to handle partial failures (although it would be rad if we could offer this ourselves via atomic mutations).