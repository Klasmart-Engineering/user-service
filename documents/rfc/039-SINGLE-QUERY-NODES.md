# RFC-039

### Synopsis
Previously we have introduced the concept of a connection node for pulling paginated data for each one of the
entities exposed through the user-service, but when it comes to exposing single elements, we use the same
approach introducing on the client unnecessary complexity that they will have to cope with.

### Background

The aim is to simplify the client usage and at the same time move away from generalising way too much the
connections queries affecting our performance (adding unnecessary filters):

Current implementation for pulling one user:
```graphql
query {
  usersConnection(direction: FORWARD, filter: {
    userId: { value: "SOMEID", operator: eq }
  }) {
    totalCount
    edges {
      node {
        id
        givenName
        familyName
        contactInfo {
          email
          phone
        }
        alternateContactInfo {
          email
          phone
        }
        ...
      }
    }
    pageInfo {
      hasNextPage
    }
  }
}
```

VS (removing all the boilerplate):

```graphql
query {
  userNode(id: "SOMEID") {
    id
    givenName
    familyName
    contactInfo {
      email
      phone
    }
    alternateContactInfo {
      email
      phone
    }
  }
}
```

This will be the beginning of differentiating between pulling one vs more than one element.

### Proposal

For every single connection query that currently exist we would create an equivalent for retriving one single
element, even if the connection query does not exist (will likely exist in the future):

- userNode
- organizationNode
- schoolNode
- classNode
- programNode
- gradeNode
- ageRangeNode
- subjectNode
- categoryNode
- subcategoryNode
- roleNode
- permissionNode

We should return the same connection node type as the connection queries
A node query will **never** be able to return more than one element.
These are **read-only** nodes. We should keep it the same way

An example implementation would be:

```graphql
...
userNode(id: ID!): UserConnectionNode
...
```

### Out of scope

- For now we will focus on retriving elements by id. Anything else will be out of scope.
- Also this RFC doesn't specify how to make perfomant queries


### Appendix
- [API](https://api.alpha.kidsloop.net/user/)

### Decision

|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| Richard          | Approved | 🟢    |
| Max              | Approved | 🟢    |
| Matthew C        | Approved | 🟢    |

