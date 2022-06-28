import 'isomorphic-fetch'
//import { Client, ClientOptions } from '@microsoft/microsoft-graph-client'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('@microsoft/microsoft-graph-client')

// eslint-disable-next-line @typescript-eslint/no-var-requires
//const Client = require("@microsoft/microsoft-graph-client")
// eslint-disable-next-line @typescript-eslint/no-unused-vars
//interface ClientOptions = require("@microsoft/microsoft-graph-client")

import { ClientCredentialAuthenticationProvider } from './authenticationProvider'

// Create Graph SDK Client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createAuthenticatedClient(): any {
    const clientOptions: unknown = {
        defaultVersion: 'v1.0',
        debugLogging: false,
        authProvider: new ClientCredentialAuthenticationProvider(),
    }

    const client = Client.initWithMiddleware(clientOptions)

    return client
}

// Delete Me from Azure B2C using MS Graph API
export async function deleteMe(id: string): Promise<void> {
    const client = createAuthenticatedClient()
    id = encodeURI(id)
    await client
        .api('/users/' + id)
        .delete()
        .catch((error: Error) => {
            //console.log(error)
            throw error
        })
}
