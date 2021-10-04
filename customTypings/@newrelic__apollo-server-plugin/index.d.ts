declare module '@newrelic/apollo-server-plugin' {
    import type { ApolloServerPlugin } from 'apollo-server-plugin-base'
    type PluginConfig = {
        captureScalars: boolean
        captureIntrospectionQueries: boolean
        captureServiceDefinitionQueries: boolean
        captureHealthCheckQueries: boolean
    }

    export default function createPlugin(
        config?: PluginConfig
    ): ApolloServerPlugin
}
