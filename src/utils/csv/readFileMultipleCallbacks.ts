import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { File } from '../../types/file'
import { ReReadable } from 'rereadable-stream'
import { EntityManager } from 'typeorm'

function formatCSVRow(row: any) {
    const keys = Object.keys(row)
    const formattedValues = Object.values(row).map((value) => {
        return value || null
    })

    keys.forEach((key, index) => {
        Object.assign(row, { [key]: formattedValues[index] })
    })

    return row
}

export async function readCSVFileMultipleCallbacks(
    manager: EntityManager,
    file: Upload,
    callbacks: Function[]
) {
    const { filename, mimetype, encoding } = file
    let rowCounter = 0 // Do not count header
    let stream
    let csvStream

    return new Promise<File>(async (resolve, reject) => {
        try {
            const rereadableStream = file
                .createReadStream()
                .pipe(new ReReadable())

            for (let i = 0; i < callbacks.length; i += 1) {
                if (i === 0) {
                    stream = rereadableStream
                    csvStream = file.createReadStream().pipe(csv())
                } else {
                    stream = rereadableStream.rewind()
                    csvStream = stream.pipe(csv())
                }

                for await (let chunk of csvStream) {
                    rowCounter += 1
                    chunk = formatCSVRow(chunk)
                    await callbacks[i](manager, chunk, rowCounter)

                    if (
                        i === callbacks.length - 1 &&
                        !csvStream.readableLength
                    ) {
                        resolve({
                            mimetype,
                            encoding,
                            filename,
                        })
                    }
                }
            }
        } catch (error) {
            reject(error)
        }
    })
}
