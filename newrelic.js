/* eslint-env node */
// Documentation: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/

// NB: @env NEW_RELIC_LICENSE_KEY and @env NEW_RELIC_APP_NAME should be set in the environment

exports.config = {
    /**
     * Should be overriden per deployment with @env NEW_RELIC_APP_NAME
     * This is here to provide a more useful default than New Relic's default of `My Application`
     */
    app_name: ['user-service_default'],
    distributed_tracing: {
        enabled: true,
    },
    logging: {
        level: 'info',
    },
    allow_all_headers: true,
    attributes: {
        exclude: [
            'request.headers.cookie',
            'request.headers.authorization',
            'request.headers.proxyAuthorization',
            'request.headers.setCookie*',
            'request.headers.x*',
            'response.headers.cookie',
            'response.headers.authorization',
            'response.headers.proxyAuthorization',
            'response.headers.setCookie*',
            'response.headers.x*',
        ],
    },
    transaction_tracer: {
        enabled: true,
        record_sql: 'raw',    
    },
    slow_sql: {
        enabled: true
    },
    error_collector: {
        expected_classes: [
            "APIError",
            "APIErrorCollection",
            "PersistedQueryNotFoundError",
            "UserInputError",
            "AuthenticationError"
        ]
    },
 }
