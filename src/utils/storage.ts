import pkgcloud from 'pkgcloud'

/**
 * Build file path on cloud storage.
 *
 * Its format is: `{prefix}/{entityId}/{YYYY-MM-DD}/{imageType}/{fileName}`
 *
 * @param entityId (string) id of an entity, for example: organization_id, user_id...
 * @param fileName (string)
 * @param prefix (string) it usually is an entity name (in plural), for example: organizations, users...
 * @param imageType (string) type (usage) of the image, for example: icon, avatar, logo, favicon...
 * @returns string
 */
export function buildFilePath(
    entityId: string,
    fileName: string,
    prefix?: string,
    imageType?: string
) {
    const paths = [
        prefix ?? 'organizations',
        entityId,
        new Date().toISOString().slice(0, 10), // get today in format YYYY-MM-DD
    ]

    if (imageType) {
        paths.push(imageType)
    }

    paths.push(fileName)

    return paths.join('/')
}

/**
 * Create a cloud storage client
 *
 * @param provider string
 * @returns pkgcloud.storage.Client
 */
export function createCloudClient(provider: string) {
    switch (provider) {
        case 'amazon':
            if (
                !process.env.STORAGE_BUCKET ||
                !process.env.STORAGE_ACCESS_KEY_ID ||
                !process.env.STORAGE_SECRET_ACCESS_KEY ||
                !process.env.STORAGE_SESSION_TOKEN ||
                !process.env.STORAGE_REGION
            ) {
                throw new Error('missing AWS env variable(s)')
            }
            return pkgcloud.storage.createClient({
                provider: 'amazon',
                keyId: process.env.STORAGE_ACCESS_KEY_ID,
                key: process.env.STORAGE_SECRET_ACCESS_KEY,
                sessionToken: process.env.STORAGE_SESSION_TOKEN,
                region: process.env.STORAGE_REGION,
                forcePathBucket: true,
            })

        case 'google':
            if (
                !process.env.STORAGE_BUCKET ||
                !process.env.STORAGE_GOOGLE_KEY_FILE_NAME ||
                !process.env.STORAGE_PROJECT_ID
            ) {
                throw new Error('missing Google Cloud env variable(s)')
            }
            return pkgcloud.storage.createClient({
                provider: 'google',
                keyFilename: process.env.STORAGE_GOOGLE_KEY_FILE_NAME,
                projectId: process.env.STORAGE_PROJECT_ID,
            })

        case 'vngcloud':
            if (
                !process.env.STORAGE_BUCKET ||
                !process.env.STORAGE_ENDPOINT ||
                !process.env.STORAGE_PROJECT_ID ||
                !process.env.STORAGE_ACCESS_KEY_ID ||
                !process.env.STORAGE_SECRET_ACCESS_KEY ||
                !process.env.STORAGE_REGION
            ) {
                throw new Error('missing VNG Cloud env variable(s)')
            }
            return pkgcloud.storage.createClient({
                provider: 'amazon',
                keyId: process.env.STORAGE_ACCESS_KEY_ID,
                key: process.env.STORAGE_SECRET_ACCESS_KEY,
                region: process.env.STORAGE_REGION,
                endpoint: process.env.STORAGE_ENDPOINT,
                forcePathBucket: true,
            })

        default:
            throw new Error('not supported provider')
    }
}
