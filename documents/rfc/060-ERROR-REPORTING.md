# Error Reporting

TL;DR:
- Report ALL errors to the console
- (Try to) Only report application errors to New Relic Errors

Why? 
- Record _all_ errors
- Alert on application errors _only_

## Client Errors

Examples:
- Invalid graphql query
- Permission/auth failure
- Entity not found

Where to report:
- logger.warn + New Relic Logs
- graphlql response

## Application Errors

Examples:
- JS runtime exceptions
- Invalid SQL query

Where to report:
- logger.error + New Relic Logs
- graphql response
- New Relic Errors

## How this works
- All errors returned to the client are logged to logger.warn
    - Can be done using Apollo's formatError hook
- All errors returned to the client are logged to New Relic Errors by default
    - With the exception of the following known client errors
        - "APIError",
        - "APIErrorCollection",
        - "PersistedQueryNotFoundError",
        - "UserInputError",
        - "AuthenticationError"
    - These can be ignored via newrelic.js
    - https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/#error_config


## Additional Resources
- [User Service Observability, Monitoring and Alerts](https://calmisland.atlassian.net/wiki/spaces/UserService/pages/2549055553/User+Service+Observability+Monitoring+and+Alerts)
