import logger from '../logging'
import { createCloudClient, STORAGE } from '../utils/storage'
import { reportError } from '../utils/resolvers/errors'

export class CloudStorageUrlBuilder {
    /**
     * Get object URL, the `bucket` must be set as `PUBLIC`. If not, users will
     * not able to see the file.
     *
     * @param provider string
     * @param filePath string
     */
    public static async call(filePath: string) {
        if (!filePath) {
            throw new Error('fileName is empty')
        }

        const client = createCloudClient(STORAGE.PROVIDER)

        client.getFile(
            STORAGE.BUCKET || 'kl-user-service',
            filePath,
            (err, file) => {
                if (err) {
                    throw new Error(`failed to get file with error ${err}`)
                }
                let paths: Array<string> = []
                switch (STORAGE.PROVIDER) {
                    case 'amazon':
                        paths = [
                            `https://${file.container}.s3.${STORAGE.REGION}.amazonaws.com`,
                            file.name,
                        ]
                        break

                    case 'google':
                        reportError(Error("Unsupported Storage Provider: google"))
                        logger.debug(file)
                        break

                    case 'vngcloud':
                        paths = [
                            `${STORAGE.ENDPOINT}/v1/AUTH_${STORAGE.PROJECT_ID}`,
                            file.container,
                            file.name,
                        ]
                        break

                    default:
                        throw new Error(`Unsupported Storage Provider: ${STORAGE.PROVIDER}`)
                }

                return paths.join('/')
            }
        )
    }
}