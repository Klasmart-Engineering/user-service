import { AuthenticationError } from 'apollo-server-express'
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
                // algorithms: ['RS512'],
                algorithms: ['RS256', 'RS384', 'RS512'],
            },
            // this key is the auth-server public key and not the auth-lambda-funcs public key
            secretOrPublicKey: [
                '-----BEGIN PUBLIC KEY-----',
                'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAr29OQ4iVeZadf8jxcKxX',
                'Im7VppDW1+G/+pVAIwybsVPNE3HZr0w40CSduqX5hOM5XGRmTtP34Zji/a5OiyqY',
                'VjHJ9YeR6NZ2R3coz+DRiGYdhzg99CWy4LnQkpOY6cdP0dDEjvVugoAi4VkIpLeB',
                'KHm0Rq6S8XKDJvbD/RK+jauWMyuPnA3RPXTbL3sXZFPx4dAaGNgzAF3C+c/pr/9H',
                'w7FFg+MAUqUJp4R9QuGT2QUCiChDgl2t2NYTlvdi/4tgwRmekxcQgG+qCiGgmiBO',
                'OmYoC2uj1rGqwZpxoISBPHbEeLjpsgBN0jNArmT3rdfJOlMzZiyC2qAocT6q/xeN',
                '8tvXM7jj0wyp2LMCqkf6+dJrknXZgIzoQIbwN3Nz5W0loZrx/wg0MTg4ZcFirX1R',
                'L3IrnciggKCrBpPAshjNtOyQHF69C+g7fu9MYc9APE1vPYyCtlXI/UFW71PVa+/K',
                '2WRusymH9FZwJBqv2OnQ/VujG5BCg5uXFAm+z6yN4WOTb3HPqZBWqqo2xSz/kpVS',
                'bIR+zKi7+4kka7gH3mZEPs24ymuSngYrtT0gYTvtzOF+pIl4SnTAZriKjZVRf1BP',
                'bav5qkwGY2hLTc1f49SKQ3KxuRZ8ITUL2H41WCPgA7lwC23H9gQYWuXXc37a99nj',
                'fuqu0FVsu/BdXaEqOL0UJwkCAwEAAQ==',
                '-----END PUBLIC KEY-----',
            ].join('\n'),
            // secretOrPublicKey: [
            //     '-----BEGIN PUBLIC KEY-----',
            //     'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA18fOlp2EQKI0aa4B+MJ9',
            //     'Ob7reHcXGbfQo2RD9YwBnM6RryAUHpq4hIGmWw5Ch57eW0NBNV3dpkTWr48UKlnV',
            //     '8HhEPyJwbXdGo1N+Qh9eo58yb+sgOxMCUXmklpxtprjXjgaH+6ecU4wCk53/jGkI',
            //     't5vvyaQogSmf8NTF95IWuT/DULc6qnB+AFBch4AHgregu3HU2aV0BC1eUdHQCF1o',
            //     'XoZOIaGfEXBOy032DzUheVM1UMCw0SNOsm9zJdOpHpGoA67fQcOGt/K8tnl2c3TW',
            //     'TZejGprudVsBheQCBh3+3b8yvRxAcOGY2YK/EX/x8jEdOY2cAxu3RnGjSpZSvYyr',
            //     'tanZ6z36oFBRSXvKsfzxhSdCZeID8z9EFnHdMK3LnhY6OinuQ7eVPZBzUQVaYBmw',
            //     'eXtm8TgI6J0L6j1z8GjpDLYZsX4pS0FKKv/vtca1K+wNe2M2PAndLFUyPYsku1CH',
            //     'JaUrn+sR8LJGDibC66ScK3CxLJpgPMVPd5XtyhfS6EmI4wr3SdktqHMxgEVSpjcj',
            //     'B+x9tQCFgxEfjMvgKAh/PNoE1CFAE5iPvmYccsZZZ6vKAHmzwhFey1Qqup2A8e11',
            //     'cpYDSlLcNMEDoQcUhjv6CsOJBaeKSAWvRKiiM3/ES8D7I9+3/yXKo0B/CTAsrau3',
            //     'q/qovQYzU2qEwtMMz65ZZ8MCAwEAAQ==',
            //     '-----END PUBLIC KEY-----',
            // ].join('\n'),
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
    const token = req.headers.authorization || req.cookies.access
    console.log(`request token: ${JSON.stringify(req.cookies)}`)
    if (!token) {
        throw new AuthenticationError('No authentication token')
    }
    const payload = decode(token)
    if (!payload || typeof payload === 'string') {
        throw new AuthenticationError('Malformed authentication token')
    }
    const issuer = payload['iss']
    if (!issuer || typeof issuer !== 'string') {
        throw new AuthenticationError('Malformed authentication token issuer')
    }
    console.log(`token issuer: ${issuer}`)
    const issuerOptions = issuers.get(issuer)
    if (!issuerOptions) {
        throw new AuthenticationError('Unknown authentication token issuer')
    }
    const { options, secretOrPublicKey } = issuerOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifiedToken = await new Promise<any>((resolve, reject) => {
        verify(token, secretOrPublicKey, options, (err, decoded) => {
            if (err) {
                console.log(`token rejected: ${err}`)
                reject(err)
            }
            if (decoded) {
                console.log(`successfully decoded token: ${decoded}`)
                resolve(decoded)
            }
            reject(new AuthenticationError('Unexpected authorization error'))
        })
    })
    return verifiedToken
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
