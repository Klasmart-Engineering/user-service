import { NextFunction, Request, Response } from 'express'
import { verify, decode, VerifyOptions, Secret } from 'jsonwebtoken'

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
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxw7TuSD72UpPMbS779d6
/87nVC2TCCO14sHboHKaFSkENgTW6gGWwUUjrSaeT2KxS0mT8gZ42ToaSZ1jakBR
4SqH8CZ+ZkFD6C5KLB+wGWzYnqt52XtHUbvH71xxN2Yd3eYGI9iLZs3ZwWUaxovW
4JvNteRlY0MnkEcjCdc/E1VqKOnr+WaENU7vgQ/V1p8fLuNA0h/7/oIjFGHd++5c
S1GdFIL29LiVrhgqyOnB8tvixT/nAd/cHHbotHNW2C1S5T1IKRkDe0K3m7eAAHzx
fhf4evczLMI1RAWEPPMsRbBZzRkn14OhpQhe+nSpkdoW3hac350vy1/pZDRFE/zS
8QIDAQAB
-----END PUBLIC KEY-----`,
        },
    ],
    [
        'calmid-debug',
        {
            options: {
                issuer: 'calmid-debug',
                algorithms: ['HS512', 'HS384', 'HS256'],
            },
            secretOrPublicKey: 'iXtZx1D5AqEB0B9pfn+hRQ==',
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

/*
    The next issuers are just for instance,
    these will be changed for real not allowed issuers
*/
const blackListIssuers = [
    'invalid-issuer',
    'black-list-issuer',
    'not-allowed-issuer',
]

export async function checkToken(token?: string) {
    try {
        if (!token) {
            return
        }
        const payload = decode(token)
        if (!payload || typeof payload === 'string') {
            return
        }
        const issuer = payload['iss']
        if (!issuer || typeof issuer !== 'string') {
            return
        }
        const issuerOptions = issuers.get(issuer)
        if (!issuerOptions) {
            return
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
        console.error(e)
    }
}

export function checkIssuerAuthorization(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const token = req.headers?.authorization

    try {
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
    } catch (error) {
        throw new Error(error)
    }
}
