import { AuthenticationProvider } from '@microsoft/microsoft-graph-client'
import * as qs from 'qs'
import axios from 'axios'

export class ClientCredentialAuthenticationProvider
    implements AuthenticationProvider {
    public async getAccessToken(): Promise<string> {
        const microsoftAppTenantId = process.env.MicrosoftAppTenantId
        if (!microsoftAppTenantId) {
            throw new Error('Missing Azure B2C Tenant Id')
        }
        const url: string =
            'https://login.microsoftonline.com/' +
            microsoftAppTenantId +
            '/oauth2/v2.0/token'

        const authString =
            process.env['USER_SERVICE_AZURE_B2C_CLIENT_KEY_AND_SECRET']

        if (!authString) {
            throw new Error('Missing Azure B2C configuration')
        }
        const authDetails = JSON.parse(authString)

        const body: object = {
            client_id: authDetails.client_id,
            client_secret: authDetails.client_secret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
        }

        const response = await axios.post(url, qs.stringify(body))

        if (response.status == 200) {
            //        console.log(response.data.access_token)
            return response.data.access_token
        } else {
            throw new Error(
                'Non 200OK response on obtaining Azure B2C token...'
            )
        }
    }
}
