## Best Practices

### Supply a `x-kidsloop-client-name` header when calling us

See the [well known clients](#well_known_clients) section

### Request only what you need, once
- Avoid overfetching data - only query what you need
- Avoid reusing expensive queries to refresh only a subset of data

### Use paginated connections
- Use the paginated connection queries instead of the deprecated relations
- Paginate data in response to user input
  - Avoid programatically paginating and querying all data
