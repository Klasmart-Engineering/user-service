import { ReadStream } from 'typeorm/platform/PlatformTools'
import * as fs from 'fs'

export const uploadImage = async (
    provider: string, // I use this to verify env variables and create the client which is used for uploading, getting images
    imageStream: ReadStream,
    fileName?: string // your desire file name
) => {
    await streamToFile(imageStream, '/tmp/' + fileName)
    return 'http://localhost:8080/' + fileName
}

const streamToFile = (inputStream: ReadStream, filePath: string) => {
    return new Promise((resolve, reject) => {
        const fileWriteStream = fs.createWriteStream(filePath)
        inputStream
            .pipe(fileWriteStream)
            .on('finish', resolve)
            .on('error', reject)
    })
}
