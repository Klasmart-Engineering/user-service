# RFC-034 - Dedicated Cache

### Synopsis

Multiple tickets either require, or would significantly benefit from, including a dedicated cache backend.

### Background

We can increase performance, reduce load on the DB and help prevent API abuse.

#### Related Tickets

Related tickets:
- [Query caching](https://calmisland.atlassian.net/browse/UD-1060)
- [Rate limiting](https://calmisland.atlassian.net/browse/UD-1105)
- [Persisted queries](https://calmisland.atlassian.net/browse/UD-1098)


### Proposal

Use [Redis](https://redis.io/) - widely supported in the Node ecosystem, and used by 'live' and 'CMS' services already in production.

Initially this will support the following use cases:

#### General Caching

We can use [npm: ioredis](https://www.npmjs.com/package/ioredis) (or alternative e.g. [npm: redis](https://www.npmjs.com/package/redis)) directly for caching values which are changed infrequently and accessed frequently.

We can then expose the Redis `client` as a private/protected member on the `Model` class, or on the GraphQL `context`, to make available for individual resolvers as required.

The initial use case identified is permissions for a User (which is checked on every request), but others (potentially around User information, or other similarly common requests) can be identified in the future.

Redis is also supported as a backend for TypeORM if using their [caching](https://typeorm.io/#/caching) feature directly.

(NB: each use case will need to be carefully considered individually, to avoid problems inherent to caching of staleness/invalidation/thundering herd etc.)

##### Alternatives

- In memory store
- Database store
- No caching

#### Rate Limiting

A basic rate limiting pattern is outlined on a Redis [blogpost](https://redis.com/redis-best-practices/basic-rate-limiting/) - if we implement our own.

Alternatively, Redis is supported as a pluggable backend store for both [npm: graphql-rate-limit](https://github.com/teamplanes/graphql-rate-limit) and [npm: express-rate-limit](https://github.com/nfriedly/express-rate-limit) if we use a ready-made solution.

##### Alternatives

- NGINX (NB: not currently available for non-K8 deployments)
    - NGINX Rate limiting [docs](https://www.nginx.com/blog/rate-limiting-nginx/)
    - K8s NGINX Ingress Controller rate limiting [docs](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#rate-limiting)

#### Persisted Queries

[Automatic Persisted Queries](https://www.apollographql.com/docs/apollo-server/performance/apq/#cache-configuration)

Enables sending a hash of a query, instead of an entire query.
This reduces request size, and saves the server from parsing/validating the query on duplicated queries.

##### Alternatives

- In memory store

#### Other

- Redis-backed DataLoaders (see [example](https://github.com/graphql/dataloader/blob/master/examples/Redis.md) on DataLoader repo) - falling back on loading from the DB for keys not found.
- Storing results of expensive resolvers (e.g. if the Student Report comes back from the dead, and we need to expose a field on our schema owned by another application, and want to avoid the overhead of HTTP requests per call to the resolver)

### Decision

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
