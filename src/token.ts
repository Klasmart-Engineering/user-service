import { NextFunction, Request, Response } from 'express'
import { verify, decode, VerifyOptions, Secret } from 'jsonwebtoken'
import { DefinitionNode, parse } from 'graphql'

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

/**
 * List of queries and mutations that external issuers can use
 */
const externalAllowOperations: Record<string, string[]> = {
    query: [],
    mutation: ['inviteExternalUser'],
}

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

                if (!issuer || typeof issuer !== 'string') {
                    res.status(401)
                    return res.send({ message: 'User not authorized' })
                }

                if (blackListIssuers.includes(issuer)) {
                    const parsedQuery = parse(req.body.query)

                    const operation = getOperation(parsedQuery.definitions[0])
                    const operationName = getOperationName(
                        parsedQuery.definitions[0]
                    )
                    console.log('operation: ' + operation)
                    console.log('operationName: ' + operationName)
                    if (
                        (!operation && !operationName) ||
                        !externalAllowOperations[operation].includes(
                            operationName
                        )
                    ) {
                        res.status(401)
                        return res.send({ message: 'User not authorized' })
                    }
                }
            }
        }

        next()
    } catch (error) {
        throw new Error(error)
    }
}

function getOperation(document: DefinitionNode) {
    if (document.kind !== 'OperationDefinition') {
        return ''
    }

    return document.operation
}

function getOperationName(document: DefinitionNode) {
    if (document.kind !== 'OperationDefinition') {
        return ''
    }

    const selectionNode = document.selectionSet.selections[0]
    if (selectionNode.kind !== 'Field') {
        return ''
    }

    return selectionNode.name.value
}
