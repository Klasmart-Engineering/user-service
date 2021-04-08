import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { File } from '../../types/file'
import { ReReadable } from 'rereadable-stream'
import { EntityManager } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Transform } from 'stream'

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

function canFinish(
    index: number,
    callbacks: CreateEntityRowCallback[],
    stream: Transform
) {
    return index === callbacks.length - 1 && !stream.readableLength
}

export async function readCSVFile(
    manager: EntityManager,
    file: Upload,
    callbacks: CreateEntityRowCallback[]
) {
    const { filename, mimetype, encoding } = file
    let rowCounter = 0 // Do not count header
    let csvStream

    return new Promise<File>(async (resolve, reject) => {
        try {
            const readStream = file.createReadStream()
            const rereadableStream = readStream.pipe(new ReReadable())

            for (let i = 0; i < callbacks.length; i += 1) {
                csvStream = i
                    ? rereadableStream.rewind().pipe(csv())
                    : readStream.pipe(csv())

                for await (let chunk of csvStream) {
                    rowCounter += 1
                    chunk = formatCSVRow(chunk)
                    await callbacks[i](manager, chunk, rowCounter)

                    if (canFinish(i, callbacks, csvStream)) {
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
