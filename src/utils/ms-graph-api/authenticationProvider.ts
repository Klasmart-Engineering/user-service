import * as qs from 'qs'
import axios from 'axios'

export class ClientCredentialAuthenticationProvider {
    public async getAccessToken(): Promise<string> {
        const microsoftAppTenantId = process.env.MicrosoftAppTenantId
        if (!microsoftAppTenantId) {
            throw new Error('Missing Azure B2C Tenant Id')
        }
        const url = `https://login.microsoftonline.com/${microsoftAppTenantId}/oauth2/v2.0/token`

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
            return response.data.access_token
        } else {
            throw new Error(
                response.status +
                    ' response on trying to obtain Azure B2C token.'
            )
        }
    }
}
