import { createCloudClient } from '../utils/storage'

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

        const client = createCloudClient(process.env.STORAGE_PROVIDER)

        client.getFile(
            process.env.STORAGE_BUCKET || 'kl-user-service',
            filePath,
            (err, file) => {
                if (err) {
                    throw new Error(`failed to get file with error ${err}`)
                }
                let paths: Array<string> = []
                switch (provider) {
                    case 'amazon':
                        paths = [
                            `https://${file.container}.s3.${process.env.STORAGE_REGION}.amazonaws.com`,
                            file.name,
                        ]
                        break

                    case 'google':
                        console.log(file)
                        break

                    case 'vngcloud':
                        paths = [
                            `${process.env.STORAGE_ENDPOINT}/v1/AUTH_${process.env.STORAGE_PROJECT_ID}`,
                            file.container,
                            file.name,
                        ]
                        break

                    default:
                        throw new Error('not supported provider')
                }

                return paths.join('/')
            }
        )
    }
}
