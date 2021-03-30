import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { File } from '../../types/file'

export async function readCSVFile(
    file: Upload,
    onData: (row: any, rowNumber: number) => void,
) {
    const { filename, mimetype, encoding } = file
    let rowCounter = 0 // Do not count header

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
