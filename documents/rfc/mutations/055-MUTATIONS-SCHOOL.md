# RFC-MUTATIONS-055 - Schools

Ticket: https://calmisland.atlassian.net/browse/UD-1405

# School mutations


## Existing Mutations

### Top level

There are 2 existing top level mutations:

- Give access to school entity mutations
- Creating schools via CSV Uploading

GraphQL definitions:

```graphql
    extend type Mutation {
        school(school_id: ID!): School
        uploadSchoolsFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
```
The first one school(school_id) is not a mutation itself but used to give access to the school entity mutations and will get deprecated

### Beyond top level

There are 12 existing beyond top level mutations

- Create a school
- Set school name and sortcode
- Add user to school
- Edit a school's programs
- Delete a school (actually inactivate a school).
- Add a role to school member
- Add several roles to school member
- User leaves school
- Edit schools in a class
- Add school to a class
- Remove school from a class

GraphQL definitions:

```graphql
    type Organization {
         ...
         createSchool(school_name: String, shortcode: String): School
         ...
    }
```

```graphql
    type School {
        ...
        set(school_name: String, shortcode: String): School
        addUser(user_id: ID!): SchoolMembership
        editPrograms(program_ids: [ID!]): [Program]
        delete(_: Int): Boolean
    }

```

```graphql
    type SchoolMembership {
         ...
         addRole(role_id: ID!): Role
         addRoles(role_ids: [ID!]!): [Role]
         removeRole(role_id: ID!): SchoolMembership
         leave(_: Int): Boolean
    }
```

```graphql
    type Class {
       ...
       editSchools(school_ids: [ID!]): [School]
       addSchool(school_id: ID!): School
       removeSchool(school_id: ID!): Boolean
       ...
    }
```

## Proposed New Root Mutations

### Input
```graphql
    input CreateSchoolsInput{
        organizationId: ID!
        schoolName: String!
        shortcode: String    
    }
```

### Output
```graphql
    type SchoolsMutationResult{
        schools: [SchoolConnectionNode!]!
    }
```
### Output (actually defined elsewhere)
#### Shown here for the purposes of context
```graphql
    type SchoolConnectionNode {
        """
        Existing
        """
        id: ID!
        name: String!
        status: Status!
        shortCode: String
        organizationId: ID!
        """
        New
        """
        programs: [ProgramConnectionNode]
        roles: [RolesConnectionNode]
        users: [UserConnectionNode]
        classes: [ClassConnectionNode]
    }
```
### Mutation
```graphql
     createSchools(input: [CreateSchoolsInput!]!) SchoolsMutationResult
```

### Input

```graphql
     """
     Note:  
     Every user in the userIDs list is assigned all the schoolRoles in 
     the schoolRoleIds list
     """
    input AddUsersToSchoolInput {
        schoolId: ID!
        schoolRoleIds: [ID!]!
        userIds: [ID!]!
    }

```
### Mutation
```graphql
    addUsersToSchools(input: [AddUsersToSchoolInput!]!): SchoolsMutationResult
```
### Input
```graphql
    input RemoveUsersFromSchoolInput {
        schoolId: ID!
        userIds: [ID!]!
    }
```
### Mutation
```graphql
    removeUsersFromSchools(input: [RemoveUsersFromSchoolInput!]!): SchoolsMutationResult
```
### Input
```graphql
    input UpdateSchoolInput{
        organizationId: ID!
        school_id: ID!
        name: String
        shortcode: String
        programs: [ID!]
        classes: [ID!]
    }
```
### Mutation
```graphql
    UpdateSchools(input: [UpdateSchoolInput!]!): SchoolsMutationResult
```

### Input
```graphql
    input AddProgramsToSchoolInput{
        schoolId: ID!
        programIds: [ID!]!
    }
```
### Mutation
```graphql
    addProgramsToSchools(input: [AddProgramsToSchoolInput!]!): SchoolsMutationResult
```
### Input
```graphql
    input RemoveProgramsFromSchoolInput{
        schoolId: ID!
        programIds: [ID!]!
    }
```
### Mutation
```graphql
    removeProgramsFromSchools(input: [RemoveProgramsFromSchoolInput!]!): SchoolsMutationResult
```

### Input
```graphql
    input addClassesToSchoolInput{
        schoolId: ID!
        classIds: [ID!]!
    }
```
### Mutation
```graphql
    addClassesToSchools(input: [AddClassesToSchoolInput!]!): SchoolsMutationResult
```
### Input
```graphql
    input RemoveClassesFromSchoolInput{
        schoolId: ID!
        classIds: [ID!]!
    }
```
### Mutation
```graphql
    removeClassesFromSchools(input: [RemoveClassesFromSchoolInput!]!): SchoolsMutationResult
```

### Input
```graphql
    input DeleteSchoolInput{
        schoolId: ID!
    }
```

### Mutation
```graphql
    deleteSchools(input: [DeleteSchoolInput!]!): SchoolsMutationResult
```




### Input limits

The maximum length of any array list  within any mutation is `50`, same with our pagination limit.

## Deprecate mutations

We'll deprecate all non-top-level mutations below so that downstream services will use new mutations. These mutations are listed in the "Beyond top level" section. The procedure to follow is documented in https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s.