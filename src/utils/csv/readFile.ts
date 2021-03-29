import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { File } from '../../types/file'
import { Model } from '../../model'

export async function readCSVFile(
    file: Upload,
    model: Model,
    onData: (row: any, rowNumber: number, model: Model) => void,
    onError: (error: any) => string,
    onEnd: () => void
) {
    const { filename, mimetype, encoding } = file
    let rowCounter = 0 // Do not count header

    return new Promise<File>(async (resolve, reject) => {
        try {
            const stream = file.createReadStream().pipe(csv())

            for await (const chunk of stream) {
                rowCounter += 1
                await onData(chunk, rowCounter, model)

                if (!stream.readableLength) {
                    onEnd()
                    resolve({
                        mimetype,
                        encoding,
                        filename,
                    })
                }
            }
        } catch (error) {
            const errorMessage = onError(error)
            reject(errorMessage)
        }
    })
}
