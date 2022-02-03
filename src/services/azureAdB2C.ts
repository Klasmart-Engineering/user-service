import passport from 'passport'
import {
    BearerStrategy,
    IBearerStrategyOptionWithRequest,
    ITokenPayload,
} from 'passport-azure-ad'
import { Request } from 'express'
import { getEnv } from '../config/config'

interface AzureB2CTokenPayload extends ITokenPayload {
    emails?: string[]
    sub: string
    iss: string
}

const credentials = {
    tenantName: getEnv({ name: 'AZURE_B2C_TENANT_NAME' }),
    clientID: getEnv({ name: 'AZURE_B2C_CLIENT_ID' }),
}
const policies = {
    policyName: getEnv({ name: 'AZURE_B2C_POLICY_NAME' }),
}
const metadata = {
    authority: getEnv({ name: 'AZURE_B2C_AUTHORITY' }),
    discovery: '.well-known/openid-configuration',
    version: 'v2.0',
}
const settings = {
    isB2C: true,
    validateIssuer: true,
    passReqToCallback: false,
    loggingLevel: 'warn',
}

const options: IBearerStrategyOptionWithRequest = {
    identityMetadata: `https://${credentials.tenantName}.b2clogin.com/${credentials.tenantName}.onmicrosoft.com/${policies.policyName}/${metadata.version}/${metadata.discovery}`,
    clientID: credentials.clientID,
    audience: credentials.clientID,
    policyName: policies.policyName,
    isB2C: settings.isB2C,
    validateIssuer: settings.validateIssuer,
    loggingLevel: 'info',
    passReqToCallback: settings.passReqToCallback,
}

const bearerStrategy = () =>
    new BearerStrategy(
        options,
        (token: ITokenPayload, done: CallableFunction) => {
            // Send user info using the second argument
            done(null, {}, token)
        }
    )

if (getEnv({ name: 'AZURE_B2C_ENABLED', orDefault: 'false' }) === 'true') {
    passport.initialize()
    passport.use(bearerStrategy())
}

export async function getAuthenticatedUser(
    req: Request
): Promise<AzureB2CTokenPayload> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await new Promise<any>((resolve, reject) => {
        passport.authenticate(
            'oauth-bearer',
            { session: false },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err: Error | null, user: boolean | never, info: any) => {
                if (err) {
                    reject({ message: 'Something went wrong' })
                }
                if (!user) {
                    reject({ message: 'Invalid token' })
                }
                resolve(info)
            }
        )(req)
    })
    return token
}

export default getAuthenticatedUser
