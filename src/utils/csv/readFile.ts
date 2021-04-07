import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { File } from '../../types/file'

export async function readCSVFile(
    file: Upload,
    onData: (row: any, rowNumber: number) => void
) {
    const { filename, mimetype, encoding } = file
    let rowCounter = 0 // Do not count header

    // alternative approach
    // return new Promise<File>((resolve, reject) => {
    //     const stream = file.createReadStream().pipe(csv())
    //     let err: Error | null = null

    //     try {
    //         stream.on('error', (error) => reject(error))

    //         stream.on('data', async (chunk) => {
    //             try {
    //                 rowCounter += 1
    //                 stream.pause()
    //                 await onData(chunk, rowCounter)
    //                 stream.resume()

    //                 if (!stream.readableLength) {
    //                     resolve({
    //                         mimetype,
    //                         encoding,
    //                         filename,
    //                     })
    //                 }
    //             } catch (error) {
    //                 reject(error)
    //             }
    //         })

    //         stream.on('end', () => {
    //             if (err) {
    //                 reject(err)
    //             }
    //         })
    //     } catch (error) {
    //         reject(error)
    //     }
    // })

    // original approach
    return new Promise<File>(async (resolve, reject) => {
        try {
            const stream = file.createReadStream().pipe(csv())

            for await (const chunk of stream) {
                rowCounter += 1
                await onData(chunk, rowCounter)

                if (!stream.readableLength) {
                    resolve({
                        mimetype,
                        encoding,
                        filename,
                    })
                }
            }
        } catch (error) {
            reject(error)
        }
    })
}
