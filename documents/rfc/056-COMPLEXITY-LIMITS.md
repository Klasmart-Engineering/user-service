# RFC-056

## Synopsis

[RFC 045-CHILD-CONNECTIONS](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/044-CHILD-CONNECTIONS.md) proposed adding nested connection fields to our schema.

This would give our clients the ability to construct very expensive operations that could have a performance impact on our application and/or database.

This RFC talks through how to enforce limits on operations to prevent that.

## Background

Here is a list of ways you can construct expensive graph QL operations which we will need to restrict.

### Deep operations

In GraphQL parents must be resolved before their children, this means you cannot batch DB queries across parents/children. As a result at least one database query will be needed per nested connection.

Nested connections also allow clients to construct circular operations of unlimited depth, and so unlimited DB queries.

```graphql
schoolsConnection{ # query 1
  edges {
    cursor,
    node {
      classesConnection{ # query 2
        edges {
          cursor,
          node {
            schoolsConnection{ # query 3
              edges {
                cursor,
                node {
                  classesConnection{ # query 4
                    edges {
                      cursor,
                      node {
                        # your can keep going forever
                        ...
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

### Request a large number of nodes

In the above example, queries at deeper layers will also be more expensive, even with dataloading.

Assume query 1 returns `10` schools and there are `10` classes in every school. That would mean query 2 will have to return `10*10` nodes, query 3 `10*10*10`, etc.

For paginated connections this branching factor is limited to 50 (our maximum page size).

Depth limiting does not fully address the issue, as you could make a very wide query:

```graphql
# note: this is not a perfect example because queries 2, 3 and 4 might in reality be dataloaded into a single query
# but it shows the basic idea
schoolsConnection{ # query 1
  edges {
    cursor,
    node {
      classesConnection{ # query 2
        edges {
          cursor,
          node {
            id
          }
        }
      },
      sneaky_alias_one:classesConnection{ # query 3
        edges {
          cursor,
          node {
            id
          }
        }
      },
      sneaky_alias_2:classesConnection{ # query 4
        edges {
          cursor,
          node {
            id
          }
        }
      }
    }
  }
}
```

This could actually be more impactful to the database as queries 2, 3 and 4 will run in parallel, and each is still trying to fetch `10*10` nodes.

### Supply complex filter arguments

Our connection queries accept `filter` parameters that let you filter results on properties of the entity, and sometimes properties of other related entities.

```
usersConnection(
  direction: FORWARD
  filter: {
    # this is a column on the user table - cheap to check
    userId: "foo"
    # this is a column on the organization table - requires a JOIN, more expensive to check
    organizationUserStatus: "bar"
    # AND/OR allows arbitary, infinite nesting of filter logic
    OR: { userId: "foo" }
  }
) {
  edges {
    node {
      id
    }
  }
}
```

A few things that could get expensive here:

* Properties of related entities require joining through to other tables.
    * If a filter exposes columns of a large number of related tables, a query could use them all and cause a huge number of JOINs
    * even worse if any of those entity is indirectly related - you will need to JOIN through intermediate tables (checking user values from a permissions connection is a good example)
* Our filters allow arbitrary nesting of conditions and it's probably a good idea to limit that
* Certain operations may also prove more expensive then others, not equals vs equals for example

### Mutations

There are two main concerns with mutations:

#### Do dataloaders work on the children of nodes returned by mutations?

If they don't, nested connection fields in this context will perform very badly.
So for now we want to enforce a stricter depth limit on mutations - a depth limit of 1.

```graphql
# not allowed
mutation switch_user($user_id: ID!){
  switch_user(user_id: $user_id){ # depth 0
    organization_ownerships{ # depth 1
      user_id # depth 2
    }
  }
}
# allowed
mutation switch_user($user_id: ID!){
  switch_user(user_id: $user_id){ # depth 0
    user_id # depth 1
  }
}
```

#### top-level mutations run in sequence - high latency and requires a db query per mutation

We want to encourage clients to aggregate mutations where possible.
We could do this my limiting the number of top level mutations allowed in an operation

```graphql
# inefficent
mutation {
  createGrade(input: {
    name: "a"
    organizationId: "b",
    progressFromGradeId: "c",
    progressToGradeId: "d"
  }): {
    id
  }
  createGrade(input: {
    name: "a"
    organizationId: "b",
    progressFromGradeId: "c",
    progressToGradeId: "d"
  }): {
    id
  }
  createGrade(input: {
    name: "a"
    organizationId: "b",
    progressFromGradeId: "c",
    progressToGradeId: "d"
  }): {
    id
  }
}
# efficent
mutation {
  createGrades(input: [
    {
      name: "a"
      organizationId: "b",
      progressFromGradeId: "c",
      progressToGradeId: "d"
    },
    {
      name: "a"
      organizationId: "b",
      progressFromGradeId: "c",
      progressToGradeId: "d"
    },
    {
      name: "a"
      organizationId: "b",
      progressFromGradeId: "c",
      progressToGradeId: "d"
    }
  ]){
    id
  }
}
```

To a lesser extent this is also true for query operations, where we want to encourage use of a connection field with a more complex filter argument, over the use of many singe node fields.

## Proposal

### Limiting total nodes

We'll do this using a complexity calculation that estimates the number of nodes based on pagination, but with the ability to override this where needed.

#### Complexity calculation

Simplifying assumptions:

* a base complexity cost of 1 per entity a connection query could return
* same cost regardless of how many columns are returned
* by default we only include connection fields in complexity calculations
    * other fields are assumed to have a complexity cost of 0
    * but we offer the ability to override this in the schema

Formula:

```
cost(X) = pagination + pagination * sum(for each child of X: cost(child))
```
complexity
An `@complexity` directive will be introduced to give a field explicit complexity (or to replace the default complexity of a connection field).

```graphql
type UserConnectionNode {
  # ...
  # we know the legacy schools field is expensive, so annote it
  schools: [SchoolSummaryNode!]! @complexity(value: 10)
  # ...
}
```

Here the directive value takes the role of pagination in the formula.

```
cost(schools) = complexityDirective + complexityDirective * sum(for each child of schools: cost(child))
```

Where a field has both a pagination argument and a complexity directive, the complexity directive will take priority.

Examples:

```graphql
# complexity: 50
schoolsConnection(directionArgs: {count: 50}){
  edges {
    cursor,
    node {
      id
    }
  }
}
# complexity: 50 + (50 * 20)
schoolsConnection(directionArgs: {count: 50}){
  edges {
    cursor,
    node {
      classesConnection(count: 20){
        edges {
          cursor,
          node {
            id
          }
        }
      }
    }
  }
}
# complexity: 50 + (50 * 10)
usersConnection(directionArgs: {count: 50}){
  edges {
    cursor,
    node {
      # remember this was given a directive @complexity(value: 10)
      schools{
        id
      }
    }
  }
}
# complexity: 50 + (50 * 20) + (50 * 10)
schoolsConnection{
  edges {
    cursor,
    node {
      classesConnection(count: 20){
        edges {
          cursor,
          node {
            id
          }
        }
      },
      # remember this was given a directive @complexity(value: 10)
      schools{
        id
      }
    }
  }
}
```

#### Proof of concept

See [this commit](https://bitbucket.org/calmisland/kidsloop-user-service/commits/2541aac0150e8a20cf51c9c9356373eac267d77f) of [this PR](https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/632/dont-merge-ud-1107-complexity-limit-poc)

It uses [graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity), a library that lets you perform a arbitrary complexity calculations for each field of a query.

You create an "estimator" which is then called for each field in the query, providing these values:

```ts
export declare type ComplexityEstimatorArgs = {
    type: GraphQLCompositeType;
    # the schema type of the field
    field: GraphQLField<any, any>;
    # the actual node supplied by the client in the query
    node: FieldNode;
    # any argument the field takes
    args: {
        [key: string]: any;
    };
    # the sum of the node's child complexities
    childComplexity: number;
};
```

#### What should we limit the complexity to?

This needs performance testing to know, and that should be a follow up piece of work.

For now, we will report calculated complexities to new relic and set an initial limit just above what clients are currently doing.

This will likely need to increase, as the use of connection fields today is much less complex then the use cases nested connections are intended to support.

### Filter complexity

We will support annotating input fields with complexity cost, similar to the above.

```
input UserFilter {
  userId: UUIDFilter @inputComplexity(value: 1)
  userStatus: StringFilter @inputComplexity(value: 2)
  ...
  AND: [UserFilter!]
  OR: [UserFilter!]
}
```

The values supplied by directives will be used initially in the complexity formula as:

```
cost(X) = pagination * sum(filterDirectives) + complexityDirective * sum(for each child of X: cost(child))
```

What's important about this is:

* filters should not contribute to the cost of child nodes - they don't impact child queries
* complexity should increase with the number of columns you filter on

It's trivial to change how filter contribute to the formula if we want to in future, just change [this line](https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/632/dont-merge-ud-1107-complexity-limit-poc#Lsrc/utils/complexity.tsT309)

What is important is that we have the ability to label input fields with complexity costs as we need to.

What values we should give input fields is out of scope of this RFC and should be investigated as follow up work.

#### Proof of concept

See [this commit](https://bitbucket.org/calmisland/kidsloop-user-service/commits/8689540a4d5b540aea1c9fa7ffb1355341064670) of [this PR](https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/632/dont-merge-ud-1107-complexity-limit-poc)

We have to implement the parsing of input arguments ourselves, as [graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity) only supplies argument values, not associated directives.

### Query depth (and mutation depth)

Currently we use a [graphql-depth-limit](https://github.com/stems/graphql-depth-limit) to limit operation depth to 10 (only allows 3 layers of connection fields).

However this library does not offer a way to customize depth for mutations.

A work around to this is to create an Apollo plugin that checks if there is a mutation operation in the document supplied by the client, and if so calls the library with a lower depth limit (1).
#### Proof of concept

See [this commit]() of [this PR](https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/632/dont-merge-ud-1107-complexity-limit-poc)

This does have a limitation - if mutations and queries are supplied in the same document AND none of them are executed, we will enforce depth limit of 1 on all of them.
However this shouldn't be much of a problem in practice as our clients don't do that. The only reason would be to supply a document of operations for a server to parser and use to answer future requests. See:

* https://stackoverflow.com/questions/49714484/why-would-you-send-multiple-operations-in-a-graphql-query-document-when-one-can
* https://github.com/graphql/graphql-spec/issues/29

### Number of mutations

We will enforce a limit on top-level fields allowed in an operation and will allow a lower limit for mutations compared to queries.

#### Proof of concept

See [this commit](https://bitbucket.org/calmisland/kidsloop-user-service/commits/b2242fca32bc7eec2c713350ce1c6cf5c175690a) of [this PR](https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/632/dont-merge-ud-1107-complexity-limit-poc)

Clients can still work around that by splitting fields over multiple operations/requests, but solving that would require a rate limiting solution which is out of scope for this RFC.

## Out of scope

* Investigating worse case performance of window queries used in our dataloaders
    * support for complexity cost in directives gives us a way to solve this if it does turn out to be an issue
* Deciding complexity values for filter fields
    * again, the above lets us easily implement correct values when we need to
* Performance testing what complexities we can really handle in production

## Appendix

Other libraries for calculating complexity:

https://github.com/pa-bru/graphql-cost-analysis
https://github.com/4Catalyzer/graphql-validation-complexity/

## Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
