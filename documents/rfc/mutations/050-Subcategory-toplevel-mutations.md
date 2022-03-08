# Subcategory Top-level Mutations

Ticket: https://calmisland.atlassian.net/browse/UD-1412

## Existing mutations

### Top level

There are 2 existing top level mutations:

- Updating an existing subcategory
- Creating subcategories via CSV uploading

Note: there will be no changes made to creating subcategories via CSV uploading.

GraphQL definitions:

```graphql
extend type Mutation {
    subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
    uploadSubCategoriesFromCSV(file: Upload!): File
        @isMIMEType(mimetype: "text/csv")
}
```

### Beyond top level

There are 3 existing beyond top level mutations:

- Delete a subcategory
- Edit a subcategory under the `Category` type
- Create or update subcategories inside `Organization` type

This RFC assumes that the non-subcategory-entity mutations will be dealt with in the context of their entities, not Subcategory.

GraphQL definitions:

```graphql
type Subcategory {
    # Mutations
    delete(_: Int): Boolean
}
```

Base types definition (this currently does not exist as of 21 Oct, but will do):

```graphql
type SubcategoryConnectionNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!
}
```

## New mutations

Based on [RFC-038: How to structure mutations](https://github.com/KL-Engineering/user-service/tree/main/documents/rfc/038-How-to-structure-mutations.md), we want to define new top-level mutations.

- Create subcategories
- Update subcategories (don't allow updating `organization_id`)
- Delete subcategories

They're **all or nothing** mutations, it will succeed when all categories are created successfully or will return errors even if one of them fails. This avoids:
- client-side mental overhead of having to keep track of what's been updated and what hasn't in our system
- server-side overhead of dealing with duplicate node scenarios if the client attempts to mutate multiple times

### Operations

- `createSubcategories`
- `updateSubcategories`
- `deleteSubcategories`

### GraphQL definitions

For `CreateSubcategoryInput`, `status` field has been omitted as it may not make sense to create an `INACTIVE` category, and it's not strictly required according to the existing `Category` type schema.

```graphql
input CreateSubcategoryInput {
    name: String!
    organizationId: ID!
}

input UpdateSubcategoryInput {
    id: ID!
    name: String
}

input DeleteSubcategoryInput {
    id: ID!
}

type SubcategoriesMutationResult {
    subcategories: [SubcategoryConnectionNode!]!
}

extend type Mutation {
    createSubcategories(input: [CreateSubcategoryInput!]!): SubcategoriesMutationResult

    updateSubcategories(input: [UpdateSubcategoryInput!]!): SubcategoriesMutationResult

    deleteSubcategories(input: [DeleteSubcategoryInput!]!): SubcategoriesMutationResult
}
```

### Input limits

The maximum length of `input` within `createSubcategories`, `updateSubcategories`, and `deleteSubcategories` is `50`, same with our pagination limit.

## Deprecate mutations

We'll deprecate all root and non-root mutations below so that downstream services will use new mutations (as mentioned, the CSV-related mutation will stay). The procedure to follow is documented in https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2367225962/Deprecating+API+s. As stated above, subcategory-related mutations happening in other entities will be defined as root mutations in other entities (i.e. create or update functions).

```
extend type Mutation {
    subcategory(id: ID!): Subcategory @isAdmin(entity: "subcategory")
}

type Subcategory {
    # Mutations
    delete(_: Int): Boolean
}
```
