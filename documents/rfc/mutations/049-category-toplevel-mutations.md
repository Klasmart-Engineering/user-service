# Category Top-level Mutations

Ticket: https://calmisland.atlassian.net/browse/UD-1411

## Existing mutations

### Top level

There are 2 existing top level mutations:

- Updating an existing category
- Creating categories via CSV uploading

Note: there will be no changes made to creating categories via CSV uploading.

GraphQL definitions:

```graphql
extend type Mutation {
    category(id: ID!): Category @isAdmin(entity: "category")
    uploadCategoriesFromCSV(file: Upload!): File
        @isMIMEType(mimetype: "text/csv")
}
```

### Beyond top level

There are 3 existing beyond top level mutations:

- Delete a category
- Edit subcategories (within `Category` type)
- Create or update categories inside `Organization` type

This RFC assumes that the Organization-related mutation will be dealt with in the context of Organizations, not Categories.

We will define replacement root mutations for `editSubcategories` under `Category`.

GraphQL definitions:

```graphql
type Category {
    # Mutations
    delete(_: Int): Boolean
    editSubcategories(subcategory_ids: [ID!]): [Subcategory]
}
```

Base types definition:

```graphql
type CategoryConnectionNode {
    id: ID!
    name: String
    subcategories: [SubcategorySummaryNode!]
    status: Status!
    system: Boolean!
}
```

## New mutations

Based on [RFC-038: How to structure mutations](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md), we want to define new top-level mutations.

- Create categories
- Update categories (don't allow updating `organization_id`)
- Delete categories
- Add subcategories to categories
- Remove subcategories from categories

They're **all or nothing** mutations, it will succeed when all categories are created successfully or will return errors even if one of them fails. This avoids:
- client-side mental overhead of having to keep track of what's been updated and what hasn't in our system
- server-side overhead of dealing with duplicate node scenarios if the client attempts to mutate multiple times

### Operations

- `createCategories`
- `updateCategories`
- `deleteCategories`
- `addSubcategoriesToCategories`
- `removeSubcategoriesFromCategories`

### GraphQL definitions

For `CreateCategoryInput`, `status` field has been omitted as it may not make sense to create an `INACTIVE` category, and it's not strictly required according to the existing `Category` type schema.

```graphql
input CreateCategoryInput {
    name: String!
    organizationId: ID!
    subcategoryIds: [ID!]
}

input UpdateCategoryInput {
    id: ID!
    name: String
    subcategoryIds: [ID!]
}

input DeleteCategoryInput {
    id: ID!
}

input AddSubcategoriesToCategoryInput {
    categoryId: ID!
    subcategoryIds: [ID!]!
}

input RemoveSubcategoriesFromCategoryInput {
    categoryId: ID!
    subcategoryIds: [ID!]!
}

type CategoriesMutationResult {
    categories: [CategoryConnectionNode!]!
}

extend type Mutation {
    createCategories(input: [CreateCategoryInput!]!): CategoriesMutationResult

    updateCategories(input: [UpdateCategoryInput!]!): CategoriesMutationResult

    deleteCategories(input: [DeleteCategoryInput!]!): CategoriesMutationResult

    addSubcategoriesToCategories(input: [AddSubcategoriesToCategoryInput!]!): CategoriesMutationResult

    removeSubcategoriesFromCategories(input: [RemoveSubcategoriesFromCategoryInput!]!): CategoriesMutationResult
}
```

### Input limits

The maximum length of `input` is `50`, same with our pagination limit.

## Deprecate mutations

We'll deprecate all root and non-root mutations below so that downstream services will use new mutations. The procedure to follow is documented in https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s. As stated above, category-related mutations happening in other entities will be defined as root mutations in other entities (i.e. create or update functions).

```
extend type Mutation {
    category(id: ID!): Category @isAdmin(entity: "category")
}

type Category {
    # Mutations
    delete(_: Int): Boolean
    editSubcategories(subcategory_ids: [ID!]): [Subcategory]
}
```