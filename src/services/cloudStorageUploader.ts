import { ReadStream } from 'fs'
import { createCloudClient } from '../utils/storage'

export class CloudStorageUploader {
    public static async call(
        imageStream: ReadStream,
        filePath: string,
    ) {
        const client = createCloudClient(process.env.STORAGE_PROVIDER || 'provider')

        const writeStream = client.upload({
            container: process.env.STORAGE_BUCKET || 'kl-user-service',
            remote: filePath,
        })

        imageStream
            .pipe(writeStream)
            .on('success', function (remoteFile) {
                // console.log(remoteFile)
                return filePath
            })
            .on('error', function (err) {
                throw new Error(`failed to upload file with error ${err}`)
            })
    }
}
