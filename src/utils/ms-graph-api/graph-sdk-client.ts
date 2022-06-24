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

// Delete Me from Graph
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteMe(id: string): Promise<any> {
    const client = createAuthenticatedClient()
    id = encodeURI(id)
    const request = await client
        .api('/users/' + id)
        .delete()
        .catch((error: Error) => {
            //console.log(error)
            throw error
        })

    //console.log(request)
}
