## Usage Guide

### Pagination

Many areas of the API have been rewritten to use pagination for scalability.

The pagination system is based on the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm) by the Relay project.
Please see the [GraphQl documentation](https://graphql.org/learn/pagination/) for additional information. 

It has the following key concepts:
  - Relationship between entities are exposed via **connections**
  - A connection has a number of **edges**
    - Each edge has a **node** containing entity information, as well as a **cursor** for pagination
  - A connection also has a **pageInfo** object containing information about the current page

Example query:
```gql
query {
  usersConnection(direction: FORWARD) {
    pageInfo {
      endCursor
      startCursor
      hasNextPage
      hasPreviousPage
    }
    totalCount
    edges {
      cursor
      node {
        givenName
      }
    }
  }
}
```


Pages sizes are limited to 50 elements. Additional results (as indicated by the `hasNextPage` and `hasPreviousPage` fields) can be retrieved by adding a `cursor` to the query.

This cursor could be the `endCursor`, `startCursor`, or a `cursor` from any edge, depending on the use case and direction.
```gql
query {
  usersConnection(direction: FORWARD, cursor: "my-cursor") {
    totalCount
  }
}
```


#### Filtering & Sorting

Pagination endpoints support complex queries for filtering and sorting data.

Filters can be constructed using the `filter` argument, and support complex logic expressions.

Keep in mind that filters have a performance cost, so use sparingly. 

Filtering example:
```gql
query {
  # get all users with a given name including "john", ignoring case
  usersConnection(
    filter: {givenName: {operator: contains, value: "john", caseInsensitive: true}}
  ) {
    totalCount
  }

  # get users whose email contains "gmail" AND family name IS "Smith"
  usersConnection(
    filter: {
      email: {operator: contains, value: "gmail"},
      familyName: {operator: eq, value: "Smith"}}
  ) {
    totalCount
  }

  # get users whose email contains "gmail" OR family name IS "Smith"
  usersConnection(
    filter: {
      OR: [
        { email: {operator: contains, value: "gmail"}},
        { familyName: {operator: eq, value: "Smith"}}
      ]
    }
  ) {
    totalCount
  }
}
```

Paginated endpoints also support sorting on specific properties via the `sort` argument.

Sorting example:
```gql
query {
  # sort users by given name, ascending
  usersConnection(sort: {field: givenName, order: ASC}) {
    totalCount
  }
}
```


#### Child connections

Connection nodes themselves may have their own connections, which we call child connections.

```gql
query {
  schoolsConnection(direction: FORWARD) {
    edges {
      node {
        # child connection
        classesConnection {
          totalCount
        }
      }
    }
  }
}
```

Since each cursor in the classConnection will be specific to the school, it doesn't make sense to paginate the classes for a specific school while querying all schools.

```gql
query {
  schoolsConnection(direction: FORWARD) {
    edges {
      node {
        # don't do this, since the cursor is specific to one school
        classesConnection(cursor: "my-cursor") {
          totalCount
        }
      }
    }
  }
}
```

If you need to paginate a child connection, it is recommended that you query the specific parent, and then paginate on the child connection.

```gql
query {
  # query the specific school
  schoolNode(id: "my-school-id") {
    # paginate away!
    classesConnection(cursor: "my-cursor") {
      totalCount
    }
  }
}
```
