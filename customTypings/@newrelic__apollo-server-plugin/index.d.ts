declare module '@newrelic/apollo-server-plugin' {
    import type { PluginDefinition } from 'apollo-server-core'
    type PluginConfig = {
        captureScalars: boolean
        captureIntrospectionQueries: boolean
        captureServiceDefinitionQueries: boolean
        captureHealthCheckQueries: boolean
    }

    export default function createPlugin(
        config?: PluginConfig
    ): PluginDefinition
}
