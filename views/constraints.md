## Constraints

The user service enforces some constrains to prevent misuse and ensure scalability.

### Page Sizes
Page sizes on connection queries are limited to a maximum of 50 nodes.
If there are additional nodes (as indicated by `totalCount`), additional pages will need be queried via the `cursor`. 

### Depth Limiting

Up to 10 levels of nesting is allowed. This allows for for a root query with three nested connection queries.  

```gql
query {
  0 {
    1 {
      2 {
        3 {
          4 {
            5 {
              6 {
                7 {
                  8 {
                    9 {
                      10 {
                        # please, no more!
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Complexity Limiting

Each query is given a complexity score. Eventually those with scores that are too high will be rejected. Today we only log them.

A query's complexity is the sum of each fields complexity.

Each field is scored as:

```
score = count * cost + count * child cost
```

Where:

* all non-connection fields use `cost=0` and `count=1`
* all connection fields use `cost=1` and `count=pagination size`
  * if no pagination size is specified, a default of 50 is used

If a field has a `@complexity` directive, its cost and count values override those above.

#### Checking query complexity

If a query is too complex, you'll get an error message in the response telling you its score and the limit.

If you want to check the score of a request below the limit, you can it using the `queryComplexity` field. For example:

```
Query {
    queryComplexity{
        score,
        limit
    }

    usersConnection(
        direction:FORWARD,
        directionArgs: {count: 30}
    ){
      edges{
          node{
            id
          }
      }
    }
}
```

Would give

```json
{
  data: {
    queryComplexity: { score: 2550, limit: 2550 },
    usersConnection: {
      edges: [
        # etc
      ]
    }
  }
}
```

#### Examples

This has a complexity of `30 + 30 * 25 = 780`.

```graphql
query {
    usersConnection(
        direction:FORWARD,
        directionArgs: {count: 30}
    ) {
        edges {
            node {
                schoolMembershipsConnection(count: 25) {
                    edges {
                      node {
                        userId
                      }
                    }
                }
            }
        }
    }
}
```

This has a complexity of `50 + 50 * 25 = 1300`

```graphql
query {
    usersConnection(
        direction:FORWARD
    ) {
        edges {
            node {
                schoolMembershipsConnection(count: 25) {
                    edges {
                      node {
                        userId
                      }
                    }
                }
            }
        }
    }
}
```

### Rate Limiting

TODO