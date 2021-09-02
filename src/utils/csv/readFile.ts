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
import { customErrors } from '../../types/errors/customError'
import { CreateEntityHeadersCallback } from '../../types/csv/createEntityHeadersCallback'

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

function checkFileType(mimetype: string) {
    if (!CSV_MIMETYPES.includes(mimetype as CsvMimeType)) {
        throw Error(
            stringInject(customErrors.invalid_file_type.message, {
                fileType: 'CSV',
            })
        )
    }
}

function checkFileSize(
    readStream: Stream,
    maxSize: number,
    filename: string,
    fileErrors: CSVError[]
) {
    return new Promise((resolve, reject) => {
        let byteLength = 0
        let fileHasData = false

        readStream.on('data', (chunk) => {
            fileHasData = true
            byteLength += chunk.length
            if (byteLength > maxSize) {
                reject(
                    Error(
                        stringInject(
                            constants.MSG_ERR_FILE_EXCEEDS_MAX_FILE_SIZE,
                            {
                                max: CSV_MAX_FILESIZE / 1024,
                            }
                        )
                    )
                )
            }
        })

        function rejectIfNoData() {
            if (!fileHasData) {
                reject(
                    Error(
                        stringInject(constants.MSG_ERR_CSV_EMPTY_FILE, {
                            filename,
                        })
                    )
                )
            }
        }

        readStream.on('end', () => {
            readStream.removeAllListeners()
            rejectIfNoData()
            resolve()
        })

        readStream.on('close', () => {
            readStream.removeAllListeners()
            rejectIfNoData()
            resolve()
        })
        readStream.on('error', (err) => {
            readStream.removeAllListeners()
            rejectIfNoData()
            reject(err)
        })
    })
}

async function checkHeaders(
    reReadable: ReReadable,
    headersCallback: CreateEntityHeadersCallback,
    filename: string,
    fileErrors: CSVError[]
) {
    const headersPromise = new Promise((resolve, reject) => {
        const csvStream = reReadable.rewind().pipe(csv())
        csvStream.on('headers', (headers) => {
            csvStream.removeAllListeners()
            resolve(headers)
        })
        csvStream.on('end', () => {
            csvStream.removeAllListeners()
            reject()
        })
        csvStream.on('close', () => {
            csvStream.removeAllListeners()
            reject()
        })
        csvStream.on('error', () => {
            csvStream.removeAllListeners()
            reject()
        })
    })

    const headers = await headersPromise
    await headersCallback(headers, filename, fileErrors)
}

async function validateFile(
    readStream: Stream,
    reReadable: ReReadable,
    headersCallback: CreateEntityHeadersCallback | undefined,
    filename: string,
    mimetype: string,
    fileErrors: CSVError[]
) {
    checkFileType(mimetype)

    await checkFileSize(readStream, CSV_MAX_FILESIZE, filename, fileErrors)

    if (headersCallback) {
        await checkHeaders(reReadable, headersCallback, filename, fileErrors)
    }

    if (fileErrors.length) throw fileErrors
}

export async function readCSVFile(
    manager: EntityManager,
    file: Upload,
    rowCallbacks: CreateEntityRowCallback[],
    userPermissions: UserPermissions,
    headersCallback: CreateEntityHeadersCallback | undefined = undefined
) {
    const { filename, mimetype, encoding } = file
    let rowCounter: number
    let csvStream
    const fileErrors: CSVError[] = []

    return new Promise<File>(async (resolve, reject) => {
        try {
            const readStream = file.createReadStream()
            const rereadableStream = readStream.pipe(new ReReadable())

            await validateFile(
                readStream,
                rereadableStream,
                headersCallback,
                filename,
                mimetype,
                fileErrors
            )

            if (fileErrors.length) {
                reject(fileErrors)
            }

            for (let i = 0; i < rowCallbacks.length; i += 1) {
                csvStream = rereadableStream.rewind().pipe(csv())
                rowCounter = 0
                for await (let chunk of csvStream) {
                    rowCounter += 1

                    chunk = formatCSVRow(chunk)

                    const rowErrors = await rowCallbacks[i](
                        manager,
                        chunk,
                        rowCounter,
                        fileErrors,
                        userPermissions
                    )

                    fileErrors.push(...rowErrors)

                    if (canFinish(i, rowCallbacks, csvStream)) {
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
                throw new Error(
                    stringInject(constants.MSG_ERR_CSV_EMPTY_FILE, {
                        filename,
                    })
                )
            }
        } catch (error) {
            reject(error)
        }
    })
}
