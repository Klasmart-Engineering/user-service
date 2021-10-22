import { NextFunction, Request, Response } from 'express'
import { verify, decode, VerifyOptions, Secret } from 'jsonwebtoken'
import getAuthenticatedUser from './services/azureAdB2C'

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

/*
    The next issuers are just for instance,
    these will be changed for real not allowed issuers
*/
const blackListIssuers = [
    'invalid-issuer',
    'black-list-issuer',
    'not-allowed-issuer',
]

export interface TokenPayload {
    [k: string]: string | undefined
    id: string
    email?: string
    phone?: string
    iss: string
}

async function checkTokenAMS(req: Request): Promise<TokenPayload> {
    try {
        const token = req.headers.authorization || req.cookies.access
        if (!token) {
            return (undefined as unknown) as TokenPayload
        }
        const payload = decode(token)
        if (!payload || typeof payload === 'string') {
            return (undefined as unknown) as TokenPayload
        }
        const issuer = payload['iss']
        if (!issuer || typeof issuer !== 'string') {
            return (undefined as unknown) as TokenPayload
        }
        const issuerOptions = issuers.get(issuer)
        if (!issuerOptions) {
            return (undefined as unknown) as TokenPayload
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
                reject(new Error('Unexpected authorization error'))
            })
        })
        return verifiedToken
    } catch (e) {
        return (undefined as unknown) as TokenPayload
    }
}

export async function checkToken(req: Request): Promise<TokenPayload> {
    if (IS_AZURE_B2C_ENABLED) {
        const azureTokenPayload = await getAuthenticatedUser(req)
        const { emails, ...rest } = azureTokenPayload
        const tokenPayload = {
            ...rest,
            id: azureTokenPayload.sub,
            iss: azureTokenPayload.iss,
            email: emails && emails?.length > 0 ? emails[0] : '',
        }
        // To be compatible with  [k: string]: string | undefined type of TokenPayload we need to convert as unknown and then convert to TokenPayload
        return (tokenPayload as unknown) as TokenPayload
    } else {
        return checkTokenAMS(req)
    }
}

export function checkIssuerAuthorization(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const token = req.headers?.authorization

    if (token) {
        const payload = decode(token)

        if (payload && typeof payload !== 'string') {
            const issuer = payload['iss']

            if (
                !issuer ||
                typeof issuer !== 'string' ||
                blackListIssuers.includes(issuer)
            ) {
                res.status(401)
                return res.send({ message: 'User not authorized' })
            }
        }
    }

    next()
}
