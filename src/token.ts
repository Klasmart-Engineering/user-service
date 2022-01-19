import { AuthenticationError } from 'apollo-server-express'
import express, { Request } from 'express'
import { decode, Secret, verify, VerifyOptions } from 'jsonwebtoken'
import getAuthenticatedUser from './services/azureAdB2C'
import { customErrors } from './types/errors/customError'
import clean from './utils/clean'
import { stringInject } from './utils/stringUtils'

const IS_AZURE_B2C_ENABLED = process.env.AZURE_B2C_ENABLED === 'true'
const issuers = new Map<
    string,
    {
        options: VerifyOptions
        secretOrPublicKey: Secret
    }
>([
    [
        'kidsloop',
        {
            options: {
                issuer: 'kidsloop',
                algorithms: ['RS512'],
            },
            secretOrPublicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxdHMYTqFobj3oGD/JDYb
DN07icTH/Dj7jBtJSG2clM6hQ1HRLApQUNoqcrcJzA0A7aNqELIJuxMovYAoRtAT
E1pYMWpVyG41inQiJjKFyAkuHsVzL+t2C778BFxlXTC/VWoR6CowWSWJaYlT5fA/
krUew7/+sGW6rjV2lQqxBN3sQsfaDOdN5IGkizsfMpdrETbc5tKksNs6nL6SFRDe
LoS4AH5KI4T0/HC53iLDjgBoka7tJuu3YsOBzxDX22FbYfTFV7MmPyq++8ANbzTL
sgaD2lwWhfWO51cWJnFIPc7gHBq9kMqMK3T2dw0jCHpA4vYEMjsErNSWKjaxF8O/
FwIDAQAB
-----END PUBLIC KEY-----`,
        },
    ],
    [
        'KidsLoopChinaUser-live',
        {
            options: {
                issuer: 'KidsLoopChinaUser-live',
                algorithms: ['RS512'],
            },
            secretOrPublicKey: [
                '-----BEGIN PUBLIC KEY-----',
                'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDAGN9KAcc61KBz8EQAH54bFwGK',
                '6PEQNVXXlsObwFd3Zos83bRm+3grzP0pKWniZ6TL/y7ZgFh4OlUMh9qJjIt6Lpz9',
                'l4uDxkgDDrKHn8IrflBxjJKq0OyXqwIYChnFoi/HGjcRtJhi8oTFToSvKMqIeUuL',
                'mWmLA8nXdDnMl7zwoQIDAQAB',
                '-----END PUBLIC KEY-----',
            ].join('\n'),
        },
    ],
])

if (process.env.NODE_ENV === 'development') {
    issuers.set('calmid-debug', {
        options: {
            issuer: 'calmid-debug',
            algorithms: ['HS512', 'HS384', 'HS256'],
        },
        secretOrPublicKey: 'iXtZx1D5AqEB0B9pfn+hRQ==',
    })
}

export interface TokenPayload {
    [k: string]: string | undefined | number | string[] | boolean
    // id is not set until client has selected
    // a particular user profile
    id?: string
    email?: string
    phone?: string
    iss: string
}

async function checkTokenAMS(req: Request): Promise<TokenPayload | undefined> {
    const token = req.headers.authorization || req.cookies.access
    if (!token) {
        return undefined
    }
    const payload = decode(token)
    if (!payload || typeof payload === 'string') {
        throw new AuthenticationError('Malformed authentication token')
    }
    const issuer = payload['iss']
    if (!issuer || typeof issuer !== 'string') {
        throw new AuthenticationError('Malformed authentication token issuer')
    }
    const issuerOptions = issuers.get(issuer)
    if (!issuerOptions) {
        throw new AuthenticationError('Unknown authentication token issuer')
    }
    const { options, secretOrPublicKey } = issuerOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifiedToken = await new Promise<any>((resolve, reject) => {
        verify(token, secretOrPublicKey, options, (err, decoded) => {
            if (err) {
                reject(err)
            }
            if (decoded) {
                resolve(decoded)
            }
            reject(new AuthenticationError('Unexpected authorization error'))
        })
    })
    return verifiedToken
}

export async function checkToken(
    req: Request
): Promise<TokenPayload | undefined> {
    let tokenPayload: TokenPayload | undefined
    if (IS_AZURE_B2C_ENABLED) {
        const azureTokenPayload = await getAuthenticatedUser(req)
        const { emails, ...rest } = azureTokenPayload
        tokenPayload = {
            ...rest,
            id: azureTokenPayload.sub,
            iss: azureTokenPayload.iss,
            email: emails && emails?.length > 0 ? emails[0] : '',
        }
    } else {
        tokenPayload = await checkTokenAMS(req)
    }
    if (tokenPayload !== undefined) {
        // the auth service that create our tokens does not normalize emails
        // as strictly as we do
        // https://calmisland.atlassian.net/browse/AD-1133?focusedCommentId=56306
        // therefor we must normalize them ourselves to ensure they match up
        // with what is saved to our db
        // cast is ok because clean.email only return null if input is null
        tokenPayload.email = clean.email(tokenPayload.email) as
            | string
            | undefined
    }
    return tokenPayload
}

export function isAPIKey(auth: string) {
    return auth.includes('Bearer: ')
}

export async function checkAPIKey(auth: string) {
    if (!(await isAPIKey(auth))) {
        return false
    }
    const apiKey = auth?.slice(auth?.indexOf('=') + 1)

    // Development check enables testing before full solution,
    // remove when secrets integration complete
    if (apiKey == 'GoToAWSInsteadOfHardCoding'  && process.env.NODE_ENV === 'development') {
        return true
    }
    throw Error('Invalid API Key')
}

export type resLocal = { token: TokenPayload | undefined; hasApiKey: boolean }
export async function validateToken(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const auth = req.headers.authorization || ''
    if (isAPIKey(auth)) {
        try {
            res.locals.hasApiKey = checkAPIKey(auth)
        } catch (e) {
            const { code, message } = customErrors.invalid_api_key

            return res.status(401).send({
                code,
                message: stringInject(message, { reason: e.message })!,
            })
        }
    } else {
        try {
            res.locals.token = await checkToken(req)
        } catch (e) {
            const { code, message } = customErrors.invalid_token

            return res.status(401).send({
                code,
                message: stringInject(message, { reason: e.message })!,
            })
        }
    }
    next()
}