import { PluginDefinition } from 'apollo-server-core'
import { complexityPlugin } from './complexity'

const staticPlugins: PluginDefinition[] = [complexityPlugin]

/**
 * Avoid importing the ApolloServerPlugin for NewRelic (which tries to load NewRelic) if not in 'production'
 * Otherwise, the following error will be triggered:
 *
 * New Relic for Node.js was unable to bootstrap itself due to an error:
 * Error: New Relic requires that you name this application!
 * Set app_name in your newrelic.js file or set environment variable
 * NEW_RELIC_APP_NAME. Not starting!
 *     at createAgent (/kidsloop-user-service/node_modules/newrelic/index.js:141:11)
 *     ... more Stack trace
 *     at Object.<anonymous> (/kidsloop-user-service/node_modules/@newrelic/apollo-server-plugin/index.js:8:18)

 */
export async function loadPlugins(): Promise<PluginDefinition[]> {
    const conditionalPlugins: PluginDefinition[] = []
    if (process.env.NODE_ENV === 'production') {
        const NewRelicPlugin = (await import('@newrelic/apollo-server-plugin'))
            .default
        conditionalPlugins.push(NewRelicPlugin())
    }
    return staticPlugins.concat(conditionalPlugins)
}
