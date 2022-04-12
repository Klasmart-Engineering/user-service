# Testing

We use the Mocha testing framework. Be sure to familiar yourself with the docs: https://mochajs.org/

## Style

Tests from the majority of the codebase, so it's important that they are consistent, concise, and readable. 

Follow the best practices listed here: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2286780504/Best+practices

## Setup

- Use factories (`tests/factories`) to create test entities
- Keep things as concise as possible
- Make it readable and understandable
- Avoid global setup, use test-specific setup

## Types of tests

### Migration tests

- Used to test database migrations
- It is best to separate schema changes from data changes, so we have *schema migrations* and *data migrations* instead of just general migrations
- Migrations should be written using **raw SQL queries** instead of the typeorm entity manager
  - benefit 1: makes it more obvious how the migration is going to perform
  - benefit 2: prevents issue where typeorm entities become incompatible with db schema
  - note: schema migrations have to be written in raw SQL anyway, so these benefits apply to data migrations

#### **Testing schema migrations**

* To test a schema migration, we should first run _all_ migrations, including later ones.
* Tests will be working with the latest version of our schema.
* DB schema should be compatible with latest typeorm entities.
* Tests need to be modified when a later mutation brings a breaking change.
* Tests can be written using the typeorm entity manager.

---
**Note**: Once all migrations have run, the database schema should be in sync with typeorm entities. Migration tests aim to verify that this is always true.

---

#### **Testing data migrations**

* To test a data migration, we should first run all _previous_ migrations, populate the database, and then run that migration.
* Tests will be working with the database schema as it was directly after the migration runs.
* If the migration is not the latest one, tests will not use the most up-to-date schema.
* DB schema could be incompatible with latest typeorm entities.
* Tests need to be written using raw SQL and not using the typeorm entity manager.

### Unit tests

- Test simple functions in isolation
- Comprehensive

```ts
describe('isSubsetOf', () => {
    it('returns false if the subset array is larger', () => {
        expect(isSubsetOf([1, 2], [1])).to.be.false
    })
    it("returns false if the subset array isn't contained in the superset", () => {
        expect(isSubsetOf([1, 3], [1, 2])).to.be.false
    })
    it('returns true if the arrays are the same', () => {
        expect(isSubsetOf([1, 2], [1, 2])).to.be.true
    })
    it('returns true if the subset array is contained in the superset', () => {
        expect(isSubsetOf([1, 2], [1, 2, 3])).to.be.true
    })
})
```

### Integration tests

- Test complex functions/resolvers in isolation
- Comprehensive
- Prefer to test GraphQL resolvers directly if possible

```ts
describe('subcategoriesConnection', () => {
    context('data', () => {
        it('returns subcategories from all the list with its corresponding data', async () => {
            // call the resolver directly
            const result = await subcategoriesConnectionResolver(info, ctx, {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
                scope,
            })
            // ...
        })
    })

    context('pagination', () => {
        it('paginates forwards', async () => {})
        it('paginates backwards', async () => {})
    })

    context('sorting', () => {
        it("returns subcategories sorted by 'id' in an ASCENDING order", async () => {})
        it("returns permissions sorted by 'id' in a DESCENDING order", async () => {})
        it("returns permissions sorted by 'name' in an ASCENDING order", async () => {})
        it("returns permissions sorted by 'name' in a DESCENDING order", async () => {})
    })

    context('filtering', () => {
        it('supports filtering by subcategory status', async () => {})
        it('supports filtering by subcategory system', async () => {})
        it('supports filtering by organization ID', async () => {})
        it('supports filtering by category ID', async () => {})
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {})
    })

    context('permissions', () => {
        // these may tests against gql, since permissions are handled outside of the scope of the resolver function
        context('when user is super admin', () => {
            it('should have access to any subcategory', async () => {})
        })
        context('when user is organization member', () => {
            it('should have access to system and own subcategories', async () => {})
        })
        context('when user has not any memberships', () => {
            it('should have access just to system subcategories', async () => {})
        })
    })
})
```

### Acceptance tests

- Test the GraphQL API directly by starting up a Docker instance
- Lightweight:
  - Happy path: test that all data is returned as expected
  - Sad path: test that the endpoint is resilient to errors and reports them appropriately

```ts
describe('subcategoriesConnection', () => {
    it('returns all data for a valid request', async () => {
        const query = `
            query {
                subcategoriesConnection(direction: FORWARD) {
                totalCount
                edges {
                    cursor
                    node {
                        id
                        name
                        status
                        system
                    }
                }
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
            }
        `

        const response = await runQuery(query, testClient, {
            authorization: getAdminAuthToken(),
        })
        expect(response.status).to.eq(200)
        // expect response.data to include everything we requested
    })
    it('returns 400 with error for an invalid request', async () => {
        const query = `
            query {
                subcategoriesConnection(direction: INVALID_DIRECTION) {
                totalCount
                edges {
                    cursor
                    node {
                        id
                        name
                        status
                        system
                    }
                }
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
            }
        `
        const response = await runQuery(query, testClient, {
            authorization: getAdminAuthToken(),
        })
        expect(response.status).to.eq(400)
        // expect response.errors to be what we expect
    })
})
```
