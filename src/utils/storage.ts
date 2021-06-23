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
    let clientParams: any = {}

    if(process.env.FORCE_LOCAL_STORAGE) {
        clientParams.endpoint = process.env.STORAGE_ENDPOINT
        clientParams.forcePathBucket =  true
    }


    if(process.env.STORAGE_ACCESS_KEY_ID) {
        clientParams.keyId = process.env.STORAGE_ACCESS_KEY_ID
    }

    if(process.env.STORAGE_SECRET_ACCESS_KEY) {
        clientParams.key = process.env.STORAGE_SECRET_ACCESS_KEY
    }

    if(process.env.STORAGE_SESSION_TOKEN) {
        clientParams.sessionToken = process.env.STORAGE_SESSION_TOKEN
    }

    switch (provider) {
        case 'amazon':
            if (
                !process.env.STORAGE_BUCKET ||
                !process.env.STORAGE_REGION
            ) {
                throw new Error('missing AWS env variable(s)')
            }
            clientParams.provider = 'amazon'
            clientParams.region = process.env.STORAGE_REGION
            break

        case 'google':
            if (
                !process.env.STORAGE_BUCKET ||
                !process.env.STORAGE_GOOGLE_KEY_FILE_NAME ||
                !process.env.STORAGE_PROJECT_ID
            ) {
                throw new Error('missing Google Cloud env variable(s)')
            }

            clientParams.provider = 'google'
            clientParams.keyFilename = process.env.STORAGE_GOOGLE_KEY_FILE_NAME
            clientParams.projectId = process.env.STORAGE_PROJECT_ID
            break

        case 'vngcloud':
            if (
                !process.env.STORAGE_PROJECT_ID ||
                !process.env.STORAGE_REGION
            ) {
                throw new Error('missing VNG Cloud env variable(s)')
            }

            clientParams.provider = 'amazon'
            clientParams.region = process.env.STORAGE_REGION
            clientParams.projectId = process.env.STORAGE_PROJECT_ID
            break

        default:
            throw new Error('not supported provider')
    }

    return pkgcloud.storage.createClient(clientParams)
}
