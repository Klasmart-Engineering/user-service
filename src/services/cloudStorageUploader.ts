import { ReadStream } from 'fs'
import { createCloudClient, STORAGE } from '../utils/storage'

export class CloudStorageUploader {
    public static async call(
        imageStream: ReadStream,
        filePath: string
    ): Promise<string | undefined> {
        const provider = STORAGE.PROVIDER || 'amazon'
        const client = createCloudClient(provider)
        const writeStream = client.upload({
            container: STORAGE.BUCKET || 'kidsloop-alpha-account-asset-objects',
            remote: filePath,
        })
        let remoteUrl = undefined
        await new Promise<void>((resolve, reject) =>
            imageStream
                .pipe(writeStream)
                .on('success', function (remoteFile) {
                    // AWS || GCP || VNGClound needs to be verified
                    resolve(
                        provider == 'vngcloud'
                            ? buildVNGCloudUrl(filePath)
                            : remoteFile?.location || remoteFile?.mediaLink
                    )
                })
                .on('error', function (err) {
                    reject(err)
                })
        ).then(
            (value) => {
                remoteUrl = value
            },
            (err) => {
                throw new Error(`failed to upload file: ${err}`)
            }
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
