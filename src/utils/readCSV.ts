import csv = require('csv-parser')
import { Upload } from '../types/upload'
import { File } from '../types/file'

export function readCSV(
    file: Upload,
    onData: (row: any) => void,
    onError: (error: any) => void,
    onEnd: () => void
) {
    const { filename, mimetype, encoding } = file

    return new Promise<File>((resolve, reject) =>
        file
            .createReadStream()
            .pipe(csv())
            .on('data', (row: any) => {
                onData(row)
            })
            .on('error', (error: any) => {
                onError(error)
                reject()
            })
            .on('end', () => {
                onEnd()
                resolve({
                    filename,
                    mimetype,
                    encoding,
                })
            })
    )
}
