# RFC-037-API-DOCUMENTATION

## Synopsis
This document explores ways that we can make our API documentation more useful and secure.

## Background
Currently, we have little API documentation other than the auto-generated schema docs. 
Although we use some annotations such as the deprecated directive, there is no
written documentation on how and when to use particular queries or mutations. 

This, alongside the large amount of deprecated/legacy/unused sections of the schema, 
can make understanding and using the API difficult for people less familiar with it.


Aside from the usability issues, there is a security concern that the entire schema & GraphQL Playground
is exposed to the public, even in production environments such as https://api.kidsloop.id/user. 

## Proposal

### User Feedback

Send out a form to get some guidance on what users are looking for in our documentation.

Some example questions we could ask:

- what are you biggest pain points when using the user service?
- what would you want to see in API documentation (select all that apply):
    - examples
    - permission requirements
    - performance guide
    - detailed written description
- where would prefer to access API documentation? 
    - via the graphql playground
    - via a dedicated docs site
    - via confluence
    - via the source repository

### Custom landing page

We can customize the Apollo landing page with a custom HTML page, where we could include:

- API overview
- Usage guide (auth, gql clients, etc)
- Schema structure
- Upcoming deprecations
- Contact/query/annoucement info and links
- Links to other docs/resources


```ts
const server = new ApolloServer({
  plugins: [
    {
      async serverWillStart() {
        return {
          async renderLandingPage() {
            const html = `
<!DOCTYPE html>
<html>
  <head>
  </head>
  <body>
    <h1>KidsLoop User Service</h1>
  </body>
</html>`
;
            return { html };
          }
        }
      }
    }
  ]
});
```

Alternatively, we could expose a dedicated endpoint for a documentation landing page:
```ts
app.get('/docs', async (req, res, next) => {
    res.send("<a wicked cool docs landing page>")
})
```


### Consistent documentation format

We'll need to develop a consistent format for explaining the following concepts across the API:

- Authorization and permission requirements
- Performance implications
- Example queries and mutations
- Constraints and related queries


I propose we do this at the GraphQL schema level using markdown so that it is accessible via the GraphQL playground.
For example:

```graphql
extend type Query {
    """
    Returns a paginated list of users that the requesting user has permissions to see with support for sorting and filtering.

    ### Permissions
    A user can see other users in their organization(s) based on their permissions within the organization
    as well as school & class memberships.

    ### Performance
    The more data you request and more complex the filter/sort/pagination inputs, the slower this query will be.
    Only request what you need.

    ### Constraints
    - Child nodes of user entities (e.g. \`schools\`) are limited to 50 elements
    """
    usersConnection(
        direction: ConnectionDirection!
        directionArgs: ConnectionsDirectionArgs
        filter: UserFilter
        sort: UserSortInput
    ): UsersConnectionResponse @isAdmin(entity: "user")
}
```


### Enforce authentication

We can intercept the GET request to the playground to check use permissions before allowing/rejecting the request.

```ts
app.get('/graphql', async (req, res, next) => {
    const encodedToken = req.headers.authorization || req.cookies.access
    try {
        // validate the token and perform any other checks
        await checkToken(encodedToken)
        
        // if checks pass, allow the playground
        expressPlayground({
            endpoint: '/graphql',
        })(req, res, next)
    } catch (e) {
        // if checks fail, reject the request
        res.status(403).send(
            'No auth token, please log in to the site and refresh this page.'
        )
    }
})
```

### Appendix
[Apollo Playground Docs](https://www.apollographql.com/docs/apollo-server/testing/build-run-queries/#apollo-sandbox)

### Decision

|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| Enrique        | Pending |   🟡  |
| Matthew      |  Approved |   🟢  |
| Max  | Approved |   🟢  |
| Richard  | Approved |   🟢  |
| Matt  | Approved  |   🟢  |
| Sam  | Pending  |   🟡  |
| Raphael  | Pending  |   🟡  |
| Marlon  | Pending  |   🟡  |
| Nicholas  | Pending  |   🟡  |
