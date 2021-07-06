import { ReadStream } from 'fs'
import { createCloudClient } from '../utils/storage'

export class CloudStorageUploader {
    public static async call(
        imageStream: ReadStream,
        filePath: string,
    ) : Promise<string | undefined> {
        const client = createCloudClient(process.env.STORAGE_PROVIDER || 'amazon')
        let remoteUrl = undefined

        const writeStream = await client.upload({
            container: process.env.STORAGE_BUCKET || 'kidsloop-alpha-account-asset-objects',
            remote: filePath,
        })

        await new Promise((resolve) =>
            imageStream
            .pipe(writeStream)
            .on('success', function (remoteFile) {
                // AWS || GCP || VNGClound needs to be verified
                remoteUrl = remoteFile?.location || remoteFile?.mediaLink
                resolve()
            })
            .on('error', function (err) {
                throw new Error(`failed to upload file with error ${err}`)
            })
        )

        return Promise.resolve(remoteUrl)
    }
}
