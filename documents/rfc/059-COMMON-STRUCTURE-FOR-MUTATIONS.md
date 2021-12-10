# RFC-059

## Synopsis

In the context of reworking mutations, creating a structure (abstract class or interface) for
all new mutations to follow help standardise our approach and speed up development. The
structure should accomplish the following objectives:

1. Cut down on common code: there should be minimal code repetition across mutations

2. Impose a common approach for all mutations of the same type (Create/Update/Delete/Add/Remove)

## Background

This is a follow-up from
[RFC-038-HOW-TO-STRUCTURE-MUTATIONS](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/038-How-to-structure-mutations.md),
related to issue [AD-1724](https://calmisland.atlassian.net/browse/AD-1724).
While RFC-038 specifies what to implement (details specified in the sub-RFCs located
[here](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/rfc/mutations/)),
it gives no instructions on how. This led to a divergence in our approaches within the team,
which ended up slowing dow the development process.

We noticed that the mutations we wrote shared a basic structure:

1. Input Checks

2. Input Normalisation (for *Create* and *Update* mutations)

3. Authorisation

4. Validate database objects, make change & build output

5. Save to database

6. Return a structure to the caller

**Input checks**: this can include static checks (using JOI validations),
and checks on the input length

**Input Normalisation**: make sure inputs are in a valid & consistent format
(we have `clean` methods for this already), should also include all possible checks

**Authorisation**: check if the user calling the mutation has the appropriate
permissions against a list of organisations and/or schools

**Validate Database Objects**: check that what was fetched from the database is
what was expected

**Make Change**: modify the database objects, effectively performing the main
objective of the mutation

**Build Output**: pass in the modified object to a list and format it for output.
This will involve mapping an `EntityConnectionNode` to a `CoreEntityConnectionNode`
if the `EntityConnectionNode` includes properties that are to be handled by resolvers
(and thus don't need to be returned)

**Save to Database**: send an update query to the database for each input element.
In the case of *Delete* mutations a batch update can be issued for all inputs
(since all we're making the same change on all objects)

## Proposal

### Common structure

The new structure to follow can be found in `src/utils/mutations/commonStructure.ts`.
The parent class is called `Mutation`, this is where most of the common logic will live.
It has the following signature:

``` typescript
abstract class Mutation<EntityType extends CustomBaseEntity, InputType, OutputType> {}
```

`Mutation` is extended by some other abstract classes in order to group common logic
by operation. These will be implemented by the mutation resolver classes.

``` typescript
abstract class CreateMutation<EntityType extends CustomBaseEntity, InputType, OutputType> {}
abstract class UpdateMutation<EntityType extends CustomBaseEntity, InputType, OutputType> {}
abstract class DeleteMutation<EntityType extends CustomBaseEntity, InputType, OutputType> {}
abstract class AddMutation<EntityType extends CustomBaseEntity, InputType, OutputType, ModifiedEntityType extends CustomBaseEntity> {}
abstract class RemoveMutation<EntityType extends CustomBaseEntity, InputType, OutputType, ModifiedEntityType extends CustomBaseEntity> {}
```

### How to use it as a resolver

The `DeleteCategories` mutation has been used as an example of how these classes should be used, the resolver function has been replaced by a class.

Before:

``` typescript
async function deleteCategories(
    args: { input: DeleteCategoryInput[] },
    context: Pick<Context, 'permissions'>
): Promise<CategoriesMutationResult> {}
```

Now:

``` typescript
class DeleteCategories extends DeleteMutation<Category, DeleteCategoryInput, CategoriesMutationResult> {}
```

### How to call the resolver

The mutation itself will be called by the `mutate()` function, which will run through all
the steps mentioned before. The method would be called in the schema in the following way
(still using `DeleteCategories` as an example):

``` typescript
export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            Mutation: {
                deleteCategories: (_parent, args, ctx, _info) =>
                    mutate(DeleteCategories, args, ctx),
            },
        },
    }
}
```

### Testing

One of the most important aspects of this change is how it will affect testing. In the same way
that the way we currently write mutations results in a lot of duplicate code, it also results
in duplicate tests. There will be integration tests for the common structure in
`tests/integration/commonStructure.tests.ts`, whatever is tested in there should not
be tested again for each mutation.

## Out of scope

* Standardising errors used by GraphQL operations. For now, we use `APIError`, but this
can be improved on, and applied to all errors.

* Finding a way to have a single source of truth for GraphQL types. GraphQL types need
to be cloned as typescript types for us to use them in resolvers. There must be some
solution out there to avoid having to do that. Perhaps generating the GraphQL schema
automatically.

## Appendix

* [The PR for the common structure code](https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/729)

## Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Toghrul          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
