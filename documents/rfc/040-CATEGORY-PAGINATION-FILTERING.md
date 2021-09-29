# RFC-040 - Categories Pagination & Filtering

### Synopsis

This is an extension of previous RFC where we introduce pagination, sorting and filtering for the different
entities of the user service. In this specific case we will only focus only on the category entity.

### Background

Categories pagination will be used for paginating the admin page like stated on [RFC-015](https://calmisland.atlassian.net/l/c/mG0HWucL). Here we will focus everything that is necessary for the new categories query.

### Implementation

To understand more about pagination go the original implementation proposal [document](https://calmisland.atlassian.net/l/c/tB1bg4Yo). Here you can find all the details about pagination and why is done the way it was done.
Specifically for categories it will look like the following:

```graphql
    extend type Query {
       ...
       categoriesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: CategoryFilter
            sort: CategorySortInput
        ): CategoriesConnectionResponse @isAdmin(entity: "category")
       ...
    }
```

For the response the most important thing to define is the node, the rest will look exactly the same.

#### Node

Aside from the core information for the entity is important to understand entities can be related to other
entities but if more information is necessary the correspondent entity connection node should be used.

```graphql
type CategoryConnectionNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!
}
```

#### Filters

```graphql
input CategoryFilter {
    status: StringFilter
    system: BooleanFilter


    # joined columns
    AND: [CategoryFilter]
    OR: [CategoryFilter]
}
```

#### Sorting

```graphql
enum CategorySortBy {
    id
    name
}

input CategorySortInput {
    field: CategorySortBy!
    order: SortOrder!
}
```

#### Permissions

- Super admins (which are being defined at https://bitbucket.org/calmisland/kidsloop-user-service/src/4b530317d54c86214ce7bb913231f2f8b899a29d/src/permissions/userPermissions.ts#lines-16 - Connect to preview until we have a better way, e.g. introduce a new role/permission): all organizations that are matching with the filters in the database are returned
- Other users: only organizations that the user belongs to and match with the filters are returned

### Out of scope
- This is the first iteration of this query. On the future new attributes can be added, and even improvements on
the implementation. This RFC will not take that into consideration
- This RFC does not reference how to make the implementation performant

### Appendix
- [API](https://api.alpha.kidsloop.net/user/)

### Decision

|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| Nicolas          | Approved | 🟢    |
| Max              | Approved | 🟢    |
| Oliver           | Approved | 🟢    |

