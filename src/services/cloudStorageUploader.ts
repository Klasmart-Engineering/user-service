import { ReadStream } from 'fs'
import { createCloudClient, STORAGE } from '../utils/storage'

export class CloudStorageUploader {
    public static async call(
        imageStream: ReadStream,
        filePath: string
    ): Promise<string | undefined> {
        const provider = STORAGE.PROVIDER || 'amazon'
        const client = createCloudClient(provider)
        let remoteUrl = undefined

        const writeStream = await client.upload({
            container: STORAGE.BUCKET || 'kidsloop-alpha-account-asset-objects',
            remote: filePath,
        })

        await new Promise<void>((resolve) =>
            imageStream
                .pipe(writeStream)
                .on('success', function (remoteFile) {
                    // AWS || GCP || VNGClound needs to be verified
                    if (provider == 'vngcloud') {
                        remoteUrl = buildVNGCloudUrl(filePath)
                    } else {
                        remoteUrl =
                            remoteFile?.location || remoteFile?.mediaLink
                    }
                    resolve()
                })
                .on('error', function (err) {
                    throw new Error(`failed to upload file with error ${err}`)
                })
        )

        return Promise.resolve(remoteUrl)
    }
}

function buildVNGCloudUrl(filePath: string) {
    return [
        `${STORAGE.ENDPOINT}/v1/AUTH_${STORAGE.PROJECT_ID}`,
        STORAGE.BUCKET,
        filePath,
    ].join('/')
}
