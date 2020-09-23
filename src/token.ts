import {verify, decode, VerifyOptions, Secret} from "jsonwebtoken"

const issuers = new Map<
    string,
    {
        options: VerifyOptions,
        secretOrPublicKey: Secret,
    }>([
    [
        "calmid-debug",
        {
            options: {
                issuer: "calmid-debug",
                algorithms: [
                    "HS512",
                    "HS384",
                    "HS256",
                ],
            },
            secretOrPublicKey: "iXtZx1D5AqEB0B9pfn+hRQ==",
            
        },
    ],
    [
        "KidsLoopChinaUser-live",
        {
            options: {
                issuer: "KidsLoopChinaUser-live",
                algorithms: ["RS512"],
            },
            secretOrPublicKey: [
                "-----BEGIN PUBLIC KEY-----",
                "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDAGN9KAcc61KBz8EQAH54bFwGK",
                "6PEQNVXXlsObwFd3Zos83bRm+3grzP0pKWniZ6TL/y7ZgFh4OlUMh9qJjIt6Lpz9",
                "l4uDxkgDDrKHn8IrflBxjJKq0OyXqwIYChnFoi/HGjcRtJhi8oTFToSvKMqIeUuL",
                "mWmLA8nXdDnMl7zwoQIDAQAB",
                "-----END PUBLIC KEY-----"
            ].join("\n")
        }
    ]
]);

export async function checkToken(token?: string) {
    try {
        if(!token) { return }
        const payload = decode(token)
        if(!payload || typeof payload === "string") { return }
        const issuer = payload["iss"]
        if(!issuer || typeof issuer !== "string") { return }
        const issuerOptions = issuers.get(issuer)
        if(!issuerOptions) { return }
        const { options, secretOrPublicKey } = issuerOptions
        const verifiedToken = await new Promise((resolve, reject) => {
            verify(token, secretOrPublicKey, options, (err, decoded) => {
                if(err) { reject(err) }
                if(decoded) { resolve(decoded) }
                reject(new Error("Unexpected authorization error")) 
            })
        })
        return verifiedToken
    } catch (e) {
        console.error(e)
    }
}