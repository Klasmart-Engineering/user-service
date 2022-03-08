## Error Handling

All errors are returned in the `errors` array in the GraphQL response. Please see [customError.ts](https://github.com/KL-Engineering/user-service/tree/main/src/types/errors/customError.ts) for the full list of application-defined error codes and messages.


### Batch Mutations

Batch mutations perform extensive input validation. For example:

- Entity not found or duplicated
- Input array contains duplicates
- Input array length exceeds the maximum allowed (50)
- User is not authorized (missing permissions)


Error handling is designed to be atomic per individual mutation - if there are errors in any of the inputs, no changes are made to the database.  Note that requests containing multiple mutations are **not** atomic - some may succeed and some may fail.

#### Example

Example invalid input:
```gql
mutation {
  addProgramsToSchools(
    # school exists, but program doesn't
    input: [{schoolId: "00100402-24d4-416c-a96d-cd04e2b02ce6", programIds: ["c6d4feed-9133-5529-8d72-1003526d1b13"]}]
  ) {
    schools {
      id
    }
  }
}
```

Example response:
```js
{
  errors: [
    {
      message: 'ERR_API_BAD_INPUT', // generic user-input error code
      // graphql request info
      locations: [
        /*...*/
      ],
      path: ['addProgramsToSchools'],
      extensions: {
        code: 'ERR_API_BAD_INPUT',
        exception: {
          // Application-defined error details are available in this array
          errors: [
            {
              // error code from customError.ts
              code: 'ERR_NON_EXISTENT_ENTITY',

              // user-friendly error message with variable substitution
              message: "On index 0, Program c6d4feed-9133-5529-8d72-1003526d1b13 doesn't exist.",

              // index of input array
              index: 0, 

              // additional error properties, depending on the type of error
              // see the corresponding message in customError.ts for the properties you can expect
              // to receive for each type of error
              variables: ['id'],
              entity: 'Program',
              entityName: 'c6d4feed-9133-5529-8d72-1003526d1b13',
            },
          ],
          stacktrace: [/*...*/],
        },
      },
    },
  ],
  data: {
    addProgramsToSchools: null,
  },
}

```

### Additional resources
- [Apollo server error handling documentation](https://www.apollographql.com/docs/apollo-server/data/errors/)
- [Batch mutation implementation design](https://github.com/KL-Engineering/user-service/tree/main/documents/rfc/059-COMMON-STRUCTURE-FOR-MUTATIONS.md)
