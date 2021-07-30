import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { File } from '../../types/file'
import { ReReadable } from 'rereadable-stream'
import { EntityManager } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Transform } from 'stream'
import { CSVError } from '../../types/csv/csvError'
import { stringInject } from '../stringUtils'
import constants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import {
    CSV_MAX_FILESIZE,
    CSV_MIMETYPES,
    CsvMimeType,
} from '../../types/csvFormat'
import * as Stream from 'stream'

function formatCSVRow(row: Record<string, unknown>) {
    const keys = Object.keys(row)
    const formattedValues = Object.values(row).map((value) => {
        return String(value).trim() || null
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

async function isFileOversized(readStream: Stream, maxSize: number) {

    return new Promise((resolve, reject) => {

        let byteLength = 0

        readStream.on('data', (chunk) => {
            byteLength += chunk.length
            if (byteLength > maxSize) {
                reject()
            }

        })
        readStream.on('end', () => {
            readStream.removeAllListeners()
            resolve()
        })
    })
}

export async function readCSVFile(
    manager: EntityManager,
    file: Upload,
    callbacks: CreateEntityRowCallback[],
    userPermissions: UserPermissions
) {
    const { filename, mimetype, encoding } = file
    let rowCounter: number
    let csvStream
    const fileErrors: CSVError[] = []

    return new Promise<File>(async (resolve, reject) => {
        try {
            if (!CSV_MIMETYPES.includes(file.mimetype as CsvMimeType)) {
                throw new Error(constants.MSG_ERR_CSV_FILE_FORMAT)
            }

            const readStream = file.createReadStream()
            const rereadableStream = readStream.pipe(new ReReadable())

            await isFileOversized(readStream, CSV_MAX_FILESIZE).catch(() => {
                const mess = stringInject(
                    constants.MSG_ERR_FILE_EXCEEDS_MAX_FILE_SIZE,
                    {
                        max: CSV_MAX_FILESIZE / 1024,
                    }
                )
                throw mess
            })

            for (let i = 0; i < callbacks.length; i += 1) {
                csvStream = rereadableStream.rewind().pipe(csv())
                rowCounter = 0
                for await (let chunk of csvStream) {
                    rowCounter += 1

                    chunk = formatCSVRow(chunk)
                    await callbacks[i](
                        manager,
                        chunk,
                        rowCounter,
                        fileErrors,
                        userPermissions
                    )

                    if (canFinish(i, callbacks, csvStream)) {
                        if (fileErrors.length) {
                            console.error(
                                'These errors were found in the file: ',
                                fileErrors
                            )
                            reject(fileErrors)
                        }

                        resolve({
                            mimetype,
                            encoding,
                            filename,
                        })
                    }
                }
            }
            if (rowCounter === 0) {
                const mess = stringInject(constants.MSG_ERR_CSV_EMPTY_FILE, {
                    filename,
                })
                throw new Error(mess)
            }
        } catch (error) {
            reject(error)
        }
    })
}
