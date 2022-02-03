import pkgcloud from 'pkgcloud'
import { getEnv } from '../config/config'

export const STORAGE = (function () {
    const storage = {
        FORCE_LOCAL_STORAGE: getEnv({ name: 'FORCE_LOCAL_STORAGE' }),
        PROVIDER: getEnv({ name: 'STORAGE_PROVIDER' }),
        BUCKET: getEnv({ name: 'STORAGE_BUCKET' }),
        REGION: getEnv({ name: 'STORAGE_REGION' }),
        ENDPOINT: getEnv({ name: 'STORAGE_ENDPOINT' }),
        ACCESS_KEY_ID: getEnv({ name: 'STORAGE_ACCESS_KEY_ID' }),
        SECRET_ACCESS_KEY: getEnv({ name: 'STORAGE_SECRET_ACCESS_KEY' }),
        SESSION_TOKEN: getEnv({ name: 'STORAGE_SESSION_TOKEN' }),
        PROJECT_ID: '',
        GOOGLE_KEY_FILE_NAME: '',
    }

    if (storage.PROVIDER == 'google' || storage.PROVIDER == 'vngcloud') {
        storage.PROJECT_ID = getEnv({ name: 'STORAGE_PROJECT_ID' })
    }

    if (storage.PROVIDER == 'google') {
        storage.GOOGLE_KEY_FILE_NAME = getEnv({
            name: 'STORAGE_GOOGLE_KEY_FILE_NAME',
        })
    }

    return storage
})()

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
    // TODO proper typing....
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientParams: any = {}

    if (STORAGE.FORCE_LOCAL_STORAGE) {
        clientParams.endpoint = STORAGE.ENDPOINT
        clientParams.forcePathBucket = true
    }

    if (STORAGE.ACCESS_KEY_ID) {
        clientParams.keyId = STORAGE.ACCESS_KEY_ID
    }

    if (STORAGE.SECRET_ACCESS_KEY) {
        clientParams.key = STORAGE.SECRET_ACCESS_KEY
    }

    if (STORAGE.SESSION_TOKEN) {
        clientParams.sessionToken = STORAGE.SESSION_TOKEN
    }

    switch (provider) {
        case 'amazon':
            if (!STORAGE.BUCKET || !STORAGE.REGION) {
                throw new Error('missing AWS env variable(s)')
            }
            clientParams.provider = 'amazon'
            clientParams.region = STORAGE.REGION
            break

        case 'google':
            if (
                !STORAGE.BUCKET ||
                !STORAGE.GOOGLE_KEY_FILE_NAME ||
                !STORAGE.PROJECT_ID
            ) {
                throw new Error('missing Google Cloud env variable(s)')
            }

            clientParams.provider = 'google'
            clientParams.keyFilename = STORAGE.GOOGLE_KEY_FILE_NAME
            clientParams.projectId = STORAGE.PROJECT_ID
            break

        case 'vngcloud':
            if (!STORAGE.PROJECT_ID || !STORAGE.REGION) {
                throw new Error('missing VNG Cloud env variable(s)')
            }

            clientParams.provider = 'amazon'
            clientParams.region = STORAGE.REGION
            clientParams.projectId = STORAGE.PROJECT_ID
            break

        default:
            throw new Error('not supported provider')
    }

    return pkgcloud.storage.createClient(clientParams)
}
