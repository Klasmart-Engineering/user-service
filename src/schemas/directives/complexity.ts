import gql from 'graphql-tag'

/*

This directive is used to override the default complexity of a field
used to calculate total query complexity in src/utils/complexity.ts

Use it like this:

```
extend type Query {
    category(id: ID!): Category @complexity(cost: 2, count: 1)
}
```

`count` should be how many entities you expect to the field to retrive
and `cost` should be how expensive you expect each entity to be.
`cost` is normally 1.

See the complexity seciton of views/constraints.md for more

*/

export default {
    typeDefs: gql`
        directive @complexity(cost: Int, count: Int) on FIELD_DEFINITION
    `,
}
