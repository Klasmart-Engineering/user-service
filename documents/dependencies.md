# Dependencies

## Blocked Upgrades

### escape-string-regexp

[5.0.0](https://nodejs.org/api/esm.html) moved the package from [CommonJS](https://nodejs.org/api/modules.html) to [ESM](https://nodejs.org/api/esm.html).

TypeScript currently only supports ESM as an experimental feature,
and additionally we would require config/codebase changes to support this.

The version update is otherwise insignificant.

### Typescript

[4.3.X](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-3.html)
seems to break TypeORM lazy loaded relations.

Until this is resolved in TypeORM, we cannot upgrade beyond `4.2.X`.

### TypeORM

[0.2.32](https://github.com/typeorm/typeorm/blob/master/CHANGELOG.md#0232-2021-03-30)
introduced a [bug](https://github.com/typeorm/typeorm/issues/7736)
with saving an existing entity (which has lazy-loaded relationships).

#### Additional Notes

When upgrading to [0.2.37](https://github.com/typeorm/typeorm/blob/master/CHANGELOG.md#0237-2021-08-13),
the following updates are necessary:

##### getWhereClauseForFilter

TypeORM parameters are now restricted to `[A-z0-9._]` characters only.

https://github.com/typeorm/typeorm/pull/8022

As we use `uuid.v4()` to create our unique identifiers (which contain hyphens), this will error.

One potential fix would be:

```typescript
const createUniqueParameter = () => uuid_v4().replace(//g, '_')

```

A `Brackets` class will always generate a `WHERE` clause in the resulting SQL, even if there are no conditions.

https://github.com/typeorm/typeorm/pull/8048

This will be filled with an always truthy `(1=1)`

(NB: this only affects testing)

##### insert().orUpdate

The API was changed from single Object with `conflict_target` and `overwrite` parameters,
to instead use the parameters directly.

e.g.

```diff
                 await createQueryBuilder().insert()
                 .into(Category)
                 .values(categoryAttributes)
-                .orUpdate({
-                    conflict_target: ['id'],
-                    overwrite: ['name', 'system', -organization_id', 'status'],
-                })
+                .orUpdate(
+                    ['name', 'system', +organization_id', 'status'],
+                    ['id']
+                )
                 .execute()
```

https://github.com/typeorm/typeorm/pull/7880

##### FindOptions

As part of the fix for filters on relation fields,
e.g.
```typescript
OrganizationMembership.find({
    organization: {
        name: 'Kidsloop'
    }
})
```

the API for filtering directly on the relation was changed (either the Entity itself, or the ID).

e.g.

```diff
    OrganizationMembership.findOne({
        where: {
            shortcode,
-                    organization: {
-                        organization_id: this.organization_id,
-                    },
+                    organization: this.organization_id,
        },
    })
```

or

```diff
    OrganizationMembership.findOne({
        where: {
            shortcode,
-                    organization: {
-                        organization_id: this.organization_id,
-                    },
+                    organization: this,
        },
    })
```
