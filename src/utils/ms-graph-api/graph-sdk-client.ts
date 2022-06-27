import 'isomorphic-fetch'
import { Client, ClientOptions } from '@microsoft/microsoft-graph-client'
import { ClientCredentialAuthenticationProvider } from './authenticationProvider'

// Create Graph SDK Client
function createAuthenticatedClient(): Client {
    const clientOptions: ClientOptions = {
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
