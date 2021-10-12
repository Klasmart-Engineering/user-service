# RFC-044

## Synopsis

While investigating how clients use our API as part of [UD-1185](https://calmisland.atlassian.net/browse/UD-1185) we found some use cases that are not covered by our current paginated connection fields.

This RFC is a proposal on how to solve issues with grouping entities.

## Background

Our root level queries will only allow access to flat lists of entities, and the first page of some relations (as summary nodes).

### How do you get all schools a user is in for a single organization, and their classes and teachers?

In general: how do you get entities grouped by their relation to another entity?

Previously:

```graphql
  query getSchoolTeacher($user_id: ID!) {
    user(user_id: $user_id) {
      school_memberships {
        school {
          status
          school_id
          school_name
          organization {
            organization_id
          }
          classes {
            status
            teachers {
              user_id
              user_name
            }
          }
        }
      }
    }
  }
```

Using only root-level connections, that would require 4 queries

* get school membership summary nodes from the user connection
* get school summary node from school membership connection
* get class summary nodes from schools connection
* get teachers summary nodes from users connection

Additionally, these need to be execute in series - as each requires a list of IDs from the previous request.

### Get teachers in active schools and classes

Previously:

```graphql
  query schoolAndTeacherByOrg($organization_id: ID!) {
    organization(organization_id: $organization_id) {
      schools {
        school_id
        school_name
        # status was then filtered on locally
        status
        classes {
          # status was then filtered on locally
          status
          class_id
          class_name
          teachers {
            user_id
            user_name
          }
        }
      }
    }
  }
```

With root-level connections you have the same problem as the previous case. This requires 4 requests (in series) to each root-level connection: organization, schools, classes, teachers.

Additionally you are doing unnecessary work by fetching schools and classes that the client is going to discard.

## Proposal

We continue to offer the planed root-level connection and node queries for each entity.
But will also offer child connections for any use case that needs to group X by Y.

```graphql
# by default we would no add the direction, filter or sort parameters to child connections
# however they can be added where there is a use case for it
# for example, maybe we want to filter out X where status is inactive.
type YConnectionNode {
  XsConnection(
    # direction: ConnectionDirection,
    # we will always offer this
    # so that the client can request small page sizes if they wish
    directionArgs: ConnectionsDirectionArgs
    # filter: SubcategoryFilter
    # sort: SubcategorySortInput
  ): XsConnectionResponse @isAdmin(entity: "X"),
}
```

These connections will be subtypes of the existing root level queries.

* child connections probably won't have as many use cases as root level ones, so they won't need to be as powerfull/complex
* by making them subtypes, it's easy to take a child query and turn it into a root query
  * for example, if you wanted the 2nd page of results and need to supply a cursor (an example can be found later on)

### Supplying a cursor to a child connection

For connections that are (possibly indirect) children of other connections, it doesn't make a lot of sense to provide a cursor argument.

That's because a cursor only makes sense in a single context.

For example, this query will not select a useful set of users for each org, as a single cursor cannot be meaningfully applied across organizations:

```graphql
query usersInOrg($cursor: string){
  organizationConnection(direction: FORWARD){
    usersConnection(
      directionArgs: {cursor: $cursor}
    ) {
      id
    }
  }
}
```

However we will allow it because:

* Other APIs like Gitlab/githubs allow it
* we can only tell at runtime whether a cursor is appropriate or not
  * as it the connection could be invoked via a connection field via a node field, or directly on a node field.
  * which means we can't forbid it via graphql types
  * to raise an error at runtime would require introspection of the client's query
    * seems complex and more hassle then its worth

Instead we trust clients to supply cursors correctly. If they don't, the only impact is that they will receive useless data back - filtered on an incorrect cursor.

### Example: Categories

Important: this example adds connections for each of the category table's relations.
In reality, we would check that a client actually has a use case for each before implementing.

```graphql
extend type Query {
    ...
    categoriesConnection(
        direction: ConnectionDirection
        directionArgs: ConnectionsDirectionArgs
        filter: CategoryFilter
        sort: CategorySortInput
    ): CategoriesConnectionResponse @isAdmin(entity: "category")
    ...
    categoriesNode(
      id: ID
    ): CategoriesConnectionNode @isAdmin(entity: "category")
    ...
}

type CategoriesConnectionResponse implements iConnectionResponse {
    totalCount: Int
    pageInfo: ConnectionPageInfo
    edges: [CategoriesConnectionEdge]
}

type CategoriesConnectionEdge implements iConnectionEdge {
    cursor: String
    node: CategoryNode
}

type CategoryNode {
    id: ID!
    name: String
    status: Status!
    system: Boolean!,
    # copy of the root query in RFC 041-SUBCATEGORY-PAGINATION-FILTERING
    subcategoriesConnection(
        direction: ConnectionDirection
        directionArgs: ConnectionsDirectionArgs
        filter: SubcategoryFilter
        sort: SubcategorySortInput
    ): SubcategoriesConnectionResponse @isAdmin(entity: "subcategory"),
    # copy of the root query in RFC 030-ORGANIZATIONS-PAGINATION-FILTERING
    organizationsConnection(
        direction: ConnectionDirection,
        directionArgs: ConnectionsDirectionArgs,
        filter: OrganizationFilter,
        sort: OrganizationSortInput
    ),
    # copy of existing subjectsConnection
    subjectsConnection(
        direction: ConnectionDirection
        directionArgs: ConnectionsDirectionArgs
        filter: SubjectFilter
        sort: SubjectSortInput
    ): SubjectsConnectionResponse @isAdmin(entity: "subject")
}
```

### Does this solve the use cases from the start?

todo: confirm the syntax for call a field that has only optional args with no args.

#### How do you get all schools a user is in for a single organization, and their classes and teachers?

Very similar to the original, just a bit more verbose.
With dataloaders this will take 4 queries, the same as both solutions above.

```graphql
query getSchoolTeacher($userId: id){
  userNode(id: $userId){
    schoolsConnection(){
      edges {
        cursor,
        node {
          classesConnection(){
            edges {
              cursor,
              node {
                # how to filter for teacher/students will be addressed in a seperate RFC
                # but will involve filtering, possibly on role ID
                usersConnection(){
                  edges {
                    cursor,
                    node {
                      id,
                      name
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

### Get teachers in active schools and classes

You can filter inside the children:

```graphql
query schoolAndTeacherByOrg($orgId: id){
  organizationNode(id: $orgId){
    schooslConnection(s
      filter: {status: "ACTIVE"}
    ){
      edges {
        cursor,
        node {
          classesConnection(
            filter: {status: "ACTIVE"}
          ){
            edges {
              cursor,
              node {
                usersConnection(){
                  edges {
                    cursor,
                    node {
                      id,
                      name
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

### Fetching the 2nd page of results

In the examples above, you are returned a cursor at each level. That can be used to fetch the 2nd page of results directly from the root-level connection for a given entity.

Example, get the remaining teachers in a class with > 50 teachers

```graphql
query teachersInClasses($id: ID, cursor: string){
  classNode(id: $id){
    # how to filter for teacher/students will be addressed in a seperate RFC
    # but will involve filtering, possibly on role ID
    usersConnection(
      cursor: $cursor,
    ){
      edges {
        cursor,
        node {
          id,
          name
        }
      }
    }
  }
}
```

#### Key Points

* these connections will return the same types of node as their root-query equivalents
* their implementations should share as much code as possible with their root-level equivalents
  * Essentially the same as calling the root query with a filter on the parent's ID
* the direction, filter and sort arguments will only be implemented if there is a use case
  * and the same goes for the allowed filter/sorting values
  * even when present the direction arg becomes optional and defaults to forwards
* all child connections will be backed by a dataloader to prevent an explosion of DB queries (see below)
* We will introduce complexity limits as part of this work
  * otherwise you can create very expensive queries

### Complexity

This approach would allow infinitely nested queries that may return many nodes.
To counter this we will put some explicit bounds on complexity:

* A limit on how deep a query may be
  * on the assumption we need to make ~1 DB call per layer
* a complexity calculation based on fields/arguments used in a query
  * extra complexity for connections that filter or sort their output
  * extra complexity depending on page sizes and the maximum possible number of nodes returned

### Using dataloaders for connections

We could use the existing approach used by dataloader children, as seen in the classes connection.

* Ask Postgres for all classes for each parent
* Throw away those after the first 50 (per parent)

However this has a bad worst case if there is a high cardinally between the parent and child.
Postgres will have to compute a large JOIN and then return a massive amount of data to our application.

To limit the amount of data that postgres needs to return we will use windowed queries.

We have a POC for this on the users inside an organization [here](https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1183-child-connections-poc) and a wiki page iwth some background on windowed queries [here](https://calmisland.atlassian.net/wiki/spaces/~550115932/pages/2287206686/Limiting+summary+nodes+to+50+elements)

Below is the SQL it generates. See the appendix for the equivalent SQL we generate already.
The key difference is moving the query to a subquery and filtering on ROWNUM.

```sql
SELECT
  *
FROM (
  SELECT
  "User"."status" AS "User_status",
  "User"."user_id" AS "User_user_id",
  "User"."given_name" AS "User_given_name",
  "User"."family_name" AS "User_family_name",
  "User"."email" AS "User_email",
  "User"."phone" AS "User_phone",
  "User"."date_of_birth" AS "User_date_of_birth",
  "User"."gender" AS "User_gender",
  "User"."avatar" AS "User_avatar",
  "User"."alternate_email" AS "User_alternate_email",
  "User"."alternate_phone" AS "User_alternate_phone",
  ROW_NUMBER() OVER (PARTITION BY "OrganizationMembership"."organization_id") AS "row_num",
  "OrganizationMembership"."organization_id" AS "orgId"
FROM
  "user"
  "User"
  INNER JOIN "organization_membership"
  "OrganizationMembership"
  ON "OrganizationMembership"."userUserId"="User"."user_id"
  WHERE (
    "OrganizationMembership"."organization_id" IN (
      $1,
      $2
    )
  )
  ORDER BY "User"."user_id" ASC NULLS LAST 
) "User"
WHERE
"row_num" <= 50
--
PARAMETERS:
["2f0b9a4a-24ac-4cf4-8b69-64477ed57298","e55479dd-c5d9-46cd-b434-0b52bfd36649"]
```

To get the total count for each org:

```sql
SELECT "orgId" count(*)
FROM (
  SELECT
    "User"."status" AS "User_status"
    "User"."user_id" AS "User_user_id"
    "User"."given_name" AS "User_given_name"
    "User"."family_name" AS "User_family_name"
    "User"."email" AS "User_email"
    "User"."phone" AS "User_phone"
    "User"."date_of_birth" AS "User_date_of_birth"
    "User"."gender" AS "User_gender"
    "User"."avatar" AS "User_avatar"
    "User"."alternate_email" AS "User_alternate_email"
    "User"."alternate_phone" AS "User_alternate_phone"
    ROW_NUMBER() OVER (PARTITION BY "OrganizationMembership"."organization_id") AS "row_num"
    "OrganizationMembership"."organization_id" as "orgId"
  FROM "user" "User"
  INNER JOIN "organization_membership" "OrganizationMembership" ON "OrganizationMembership"."userUserId"="User"."user_id"
  WHERE (
    "OrganizationMembership"."organization_id" IN ($1 $2)
  )
  ORDER BY "User"."user_id" ASC NULLS LAST
) "subquery"
GROUP BY "orgId"
-- PARAMETERS: ["2f0b9a4a-24ac-4cf4-8b69-64477ed57298"
"e55479dd-c5d9-46cd-b434-0b52bfd36649"]
```

The INNER JOIN on the subquery could still be a problem for high cardinality relationships.
But importantly this is already a problem with our existing dataloaders.

In those cases become an issue we might consider:

* Use correlated subqueries instead
  * Each subquery will do a much smaller JOIN, but we will have to do it many times
* Splitting the window function into multiple smaller queries
  * Each JOINing on only 1/Nth of the parents loaded into the dataloader
* Limiting the page sizes that are allowed for child queries in high cardinality contexts
  * organizations are likely to have many users, page size must be low
  * classes are likely to have only a few users, page size can be high

All are slower in the best case (low cardinally) but have better bounds on their worst case (high cardinality).

## Out of scope

How to fetch a list of students/teachers in a class.
There are potential plans to re-think how a teacher/student is represented by our service.
This could involve relying on clients using roles to define this (speak to @emfg for more).
This RFC doesn't have an opinion and only offers a way to get a list of all users in a class.
Probably it will be addressed in an RFC specifically for the class > users child connection.

How to fetch flat lists of entities filtered by a relation to another entities - "get all permissions for this user"

* This is terrible to do with both the existing connections and the child connection proposal. Will be address in another RFC

The exact algorithm for calculating complexity and the library to use for calculating - this deserves its own RFC

## Appendix

The current data loader queries for users look like this:

Count:

```sql
SELECT
  COUNT(DISTINCT("User"."user_id")) AS "cnt"
FROM
"user" "User"
INNER JOIN "organization_membership" "OrganizationMembership" ON "OrganizationMembership"."userUserId"="User"."user_id"
WHERE (
  ("OrganizationMembership"."organization_id" = $1)
)
```

Query so TypeORM can automagic results into JS objects:
(our POC does this manually at the application layer)

```sql
SELECT
  DISTINCT "distinctAlias"."User_user_id" as "ids_User_user_id"
  "distinctAlias"."User_user_id"
FROM (
  SELECT
    "User"."status" AS "User_status"
    "User"."user_id" AS "User_user_id"
    "User"."given_name" AS "User_given_name"
    "User"."family_name" AS "User_family_name"
    "User"."email" AS "User_email"
    "User"."phone" AS "User_phone"
    "User"."date_of_birth" AS "User_date_of_birth"
    "User"."gender" AS "User_gender"
    "User"."avatar" AS "User_avatar"
    "User"."alternate_email" AS "User_alternate_email"
    "User"."alternate_phone" AS "User_alternate_phone"
  FROM "user" "User"
  INNER JOIN "organization_membership" "OrganizationMembership" ON "OrganizationMembership"."userUserId"="User"."user_id"
  WHERE (
    ("OrganizationMembership"."organization_id" = $1)
  )
) "distinctAlias"
ORDER BY
  "distinctAlias"."User_user_id" ASC NULLS LAST
  "User_user_id" ASC
LIMIT 51
-- PARAMETERS: ["2853ac0c-ddd3-4537-b07b-25045e9cba6e"]
```

Actual data query:

```sql
SELECT
  "User"."status" AS "User_status"
  "User"."user_id" AS "User_user_id"
  "User"."given_name" AS "User_given_name"
  "User"."family_name" AS "User_family_name"
  "User"."email" AS "User_email"
  "User"."phone" AS "User_phone"
  "User"."date_of_birth" AS "User_date_of_birth"
  "User"."gender" AS "User_gender"
  "User"."avatar" AS "User_avatar"
  "User"."alternate_email" AS "User_alternate_email"
  "User"."alternate_phone" AS "User_alternate_phone"
FROM "user" "User"
INNER JOIN "organization_membership" "OrganizationMembership" ON "OrganizationMembership"."userUserId"="User"."user_id"
WHERE (
  (
    ("OrganizationMembership"."organization_id" = $1)
  )
) AND (
  "User"."user_id" IN ($2)
)
ORDER BY
  "User"."user_id" ASC NULLS LAST
-- PARAMETERS: ["2853ac0c-ddd3-4537-b07b-25045e9cba6e"
"381a3ea1-09c3-4d92-907e-3f51adf87054"]
```

### Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Approved |   🟢   |
| Oliver           | Approved |   🟢   |
| Matthew          | Approved |   🟢   |
| Richard          | Approved |   🟢   |
| Marlon           | Approved |   🟢   |
| Max              | Approved |   🟢   |
