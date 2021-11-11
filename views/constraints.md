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

TODO

### Rate Limiting

TODO